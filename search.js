"use strict";

//
// IAS2.1
// Search Internals
//

var idx = {}
var base_url = ""

function set_base_url(url) {
	base_url = url
}

function search_init() {
	var idx_load = function(data) {
		idx = data
		ui_init()
	}

	get(base_url + "idx.json", idx_load, "json")
}

var cache = Array(30522)

function ensure_row(i) {
	if (i in cache) {
		return cache[i]
	}

	cache[i] = null

	var load_row_fn = function(data) {
		cache[i] = new Uint8Array(data)
		queue(run_search)
	}

	get(base_url + "token/" + i + ".gz", load_row_fn, "arraybuffer")
}

function ensure_rows(weights) {
	var all_cached = true

	for (var i in weights) {
		if (!ensure_row(i))
			all_cached = false
	}

	return all_cached
}

function decompress(i) {
	var start = performance.now()
	var decompressed = fflate.gunzipSync(cache[i])
	var elapsed = performance.now() - start

	console.log(elapsed)

	return new Float32Array(decompressed.buffer)
}

// Takes token weights:
// { 2015: 1, 20681: 1, 27940: -1 }
function query_magnitude(weights) {
	var sum = 0.0

	for (var k in weights) {
		var v = weights[k]
		sum += v**2
	}

	return sum**0.5
}

// Runs a query
// All documents that lack any of the query tokens are discarded
function strict_intersect_query(weights, pre_sort_fn) {
	var entries = []

	for (var title in idx) {
		entries.push({
			title: title,
			score: 0.0,
			is_stray: false,
			drop: false
		})
	}

	for (var id in weights) {
		var scores = decompress(id)
		var k = weights[id]

		for (var i = 0; i < entries.length; i++) {
			if (scores[i] > 0.0) {
				entries[i].score += scores[i] * k
			} else if (scores[i] < 0.0) {
				entries[i].score -= scores[i] * k
				entries[i].is_stray = true
			} else {
				entries[i].drop = true
			}
		}
	}

	var query_mag = query_magnitude(weights)
	var total_mag = 0.0
	var matches = []

	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i]

		if (!entry.drop) {
			var mag = idx[entry.title].magnitude

			entry.magnitude = mag
			entry.score = entry.score / (mag * query_mag)
			matches.push(entry)

			total_mag += mag
		}
	}

	if (pre_sort_fn)
		pre_sort_fn(matches, total_mag)

	var sort_fn = function(a, b) {
		return b.score - a.score
	}

	matches.sort(sort_fn)

	return matches
}

// All else being equal, prefer larger documents
function prefer_longer_fn(matches, total_mag) {
	var acc = 0.0

	for (var i = 0; i < matches.length; i++) {
		acc += matches[i].score *= (matches[i].magnitude / total_mag)
	}

	//for (var i = 0; i < matches.length; i++) {
	//	matches[i].score /= acc
	//}
}

// All else being equal, prefer shorter documents
function prefer_shorter_fn(matches, total_mag) {
	var acc = 0.0

	for (var i = 0; i < matches.length; i++) {
		acc += matches[i].score /= (matches[i].magnitude / total_mag)
	}

	//for (var i = 0; i < matches.length; i++) {
	//	matches[i].score /= acc
	//}
}
