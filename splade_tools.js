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
//	"elements": 1420,
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
function find_similar_to(title) {
	var results = []
	var a = idx[title]

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

// Takes an array of token IDs as produced by BERT tokenizer, twice
function imagine_idx_entry(required, rejected) {
	var distinct_total = 0
	var distinct = {}

	// Assign more value to recurring required tokens
	for (var id of required) {
		if (id in distinct) {
			distinct[id]++
		} else {
			distinct[id] = 1
			distinct_total++
		}
	}

	// Assign evermore significant negative value to recurring rejected tokens
	// Some funky behaviors:
	// - "semiconductors -lobsters" will lead to "s" having a value of 0.0
	// - "ass -ass" will lead to "ass" with a value of 0.0
	for (var id of rejected) {
		if (id in distinct) {
			distinct[id]--
		} else {
			distinct[id] = -1
			distinct_total++
		}
	}

	var dot = 0.0
	var k = new Uint16Array(distinct_total)
	var v = new Float32Array(distinct_total)
	var i = 0

	for (var id in distinct) {
		k[i] = id
		v[i] = distinct[id]
		dot += distinct[id]**2

		i++
	}

	// Take square root
	var mag = dot**0.5

	return { "elements": distinct_total, "magnitude": mag, "keys": k, "values": v }
}

// Takes an imaginary index entry as produced by imagine_idx_entry()
function find_similar_query(a) {
	var results = []

	for (var target in idx) {
		var b = idx[target]
		var ab = cosine_similarity(a, b, true)
		
		if (ab != 0.0) {
			results.push( { title: target, score: ab } )
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

	results = results.slice(0, 50)

	var tokens = []

	for (var entry of results)
		tokens.push(entry.token)

	return "[ " + tokenizer.convertIdsToTokens(tokens).join(", ") + " ]"
}
