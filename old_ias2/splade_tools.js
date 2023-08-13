"use strict";

// Datatape K 	Uint16 token IDs
// Datatape V 	Float32 token weights
var datatape_k
var datatape_v
var idx

function populate_views() {
	log("Populating datatape views...")

	var time_start = performance.now()

	// Offset is in bytes
	var tape_offset_k = 0
	var tape_offset_v = 0

	for (var filename in idx) {
		var entry = idx[filename]

		var keys = new Uint16Array(datatape_k, tape_offset_k, entry.dimensions)
		var values = new Float32Array(datatape_v, tape_offset_v, entry.dimensions)
		
		// "Expanded keys" where compact representation is restored to its full 30522 dimensions
		var expkeys = new Uint16Array(30522)

		expkeys.fill(-1)

		for (var i = 0; i < entry.dimensions; i++) {
			expkeys[ keys[i] ] = i
		}

		// Tokens that have some weight but were never seen in the text of the document itself
		// The indexer makes their weight negative during a postprocessing step
		// We undo that, but keep track of the token IDs
		var stray = []

		for (var i = 0; i < entry.dimensions; i++) {
			if (values[i] < 0.0) {
				values[i] = -values[i]
				stray.push( keys[i] )
			} 
		}

		entry.keys = keys
		entry.values = values
		entry.expkeys = expkeys
		entry.stray = stray

		tape_offset_k += entry.dimensions * 2
		tape_offset_v += entry.dimensions * 4
	}

	var time_done = performance.now()

	log("Done! Took", time_done - time_start, "ms")
}


// We have the following structure
// {
//	"dimensions": 1420,
//	"magnitude": 70.5,
//  "keys": [ Uint16 ],
//  "values": [ Float32 ]
// }
function dot(a, b, strict_intersect = false) {
	var sum = 0.0

	// Try to select the shorter sequence for the loop
	var shorter = b
	var longer = a

	// Swap if we guessed wrong
	if (a.dimensions < b.dimensions) {
		shorter = a
		longer = b
	}

	// Also a small hack
	// No expkeys on user queries
	if ("expkeys" in a === false) {
		shorter = a
		longer = b
	}

	var sk = shorter.keys
	var sv = shorter.values
	var lk = longer.expkeys
	var lv = longer.values

	for (var idx_s = 0; idx_s < sk.length; idx_s++) {
		var key = sk[idx_s]
		var idx_l = lk[key]

		if (idx_l <= 30522) {
			sum += sv[idx_s] * lv[idx_l]
		} else {
			// Key not found but was required
			if (strict_intersect && sv[idx_s] > 0)
				return 0.0
		}
	}

	return sum
}

// Cosine similarity is absolutely necessary for SPLADE
// It just doesn't work at all if you only do the dot()
function cosine_similarity(a, b, strict_intersect = false) {
	return dot(a, b, strict_intersect) / (a.magnitude * b.magnitude)
}


// We have the following structure
// {
//	"file1.txt": {},
//	"file2.txt": {},
// }
function find_similar_to(title, tf_idf = false) {
	var results = []
	var a = idx[title]

	if (tf_idf)
		a = apply_tf_idf(a)

	for (var target in idx) {
		if (target === title)
			continue

		var b = idx[target]
		var ab = cosine_similarity(a, b)
		
		results.push( { title: target, score: ab } )
	}

	var sort_fn = function(a, b) { return b.score - a.score }

	results.sort(sort_fn)
	
	return results
}

// Takes an object where keys are BERT token IDs and values are weights:
// { 2015: 0.0, 20681: 1.0, 27940: -1.0 }
function imagine_idx_entry(vec) {
	var total = Object.keys(vec).length

	var expvalues = new Float32Array(30522)
	var k = new Uint16Array(total)
	var v = new Float32Array(total)
	var dot = 0.0
	var i = 0

	expvalues.fill(0.0)

	for (var id in vec) {
		var _k = parseInt(id)
		var _v = vec[id]

		k[i] = _k
		v[i] = _v
		dot += _v**2
		expvalues[_k] = _v

		i++
	}

	// Take square root
	var mag = dot**0.5

	return { "dimensions": total, "magnitude": mag, "keys": k, "values": v, "expvalues": expvalues }
}

// Takes an imaginary index entry as produced by imagine_idx_entry() and a real index entry
function is_stray(a, b) {
	for (var i = 0; i < b.stray.length; i++) {
		if (a.expvalues[b.stray[i]] > 0.0)
			return true
	}

	return false
}

// Takes an imaginary index entry as produced by imagine_idx_entry()
function find_similar_query(a) {
	var results = []

	for (var target in idx) {
		var b = idx[target]
		var ab = cosine_similarity(a, b, true)
		
		if (ab != 0.0) {
			results.push( { title: target, score: ab, is_stray: is_stray(a, b) } )
		} else {
			// Discarded
		}
	}

	var sort_fn = function(a, b) { return b.score - a.score }

	results.sort(sort_fn)

	log("Returning", results.length, "entries")
	
	return results
}

var total_sums = null

function build_total_sums() {
	log("Accumulating total sums...")

	var time_start = performance.now()

	total_sums = new Float64Array(30522)

	for (var title in idx) {
		var entry = idx[title]

		for (var i = 0; i < entry.dimensions; i++) {
			var k = entry.keys[i]
			var v = entry.values[i]

			total_sums[k] += v
		}
	}

	var time_done = performance.now()

	log("Done! Took", time_done - time_start, "ms")
}

// Predicts a query that should return a given title as the best match
function predict_best_query(title) {
	var entry = idx[title]
	var results = []

	for (var i in entry.keys) {
		var k = entry.keys[i]
		var v = entry.values[i]

		// This is essentially TF-IDF
		results[i] = { token: k, score: v * v/total_sums[k] }
	}

	var sort_fn = function(a, b) { return b.score - a.score }

	results.sort(sort_fn)

	return results
}

// Takes an index entry
function apply_tf_idf(entry) {
	var values = new Float32Array(entry.dimensions)
	var dot = 0.0

	for (var i = 0; i < entry.dimensions; i++) {
		var k = entry.keys[i]
		var v = entry.values[i]

		var value = v * v/total_sums[k]

		values[i] = value
		dot += value**2
	}

	// Take square root
	var mag = dot**0.5

	return { "dimensions": entry.dimensions, "magnitude": mag, "keys": entry.keys, "values": values, "expkeys": entry.expkeys }
}
