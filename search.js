"use strict";

var tokenizer = new BertTokenizer()

var input = null
var disp = null
var results = []
var results_div = null
var more = null
var search_timeout = -1

function init_search() {
	var main = document.body.children[1]

	input = add("input", main)

	input.type = "text"
	input.placeholder = "Search..."
	input.oninput = search_timeout_reset

	disp = add("div", main, "Protip: syntax like -word, 5*word, -5*word is supported.") 

	disp.classList.add("breakdown")

	results_div = add("div", main)
	more = add("button", main, "Show 100 more")
	more.classList.add("hide")

	more.onclick = function() {
		show_more_results(100)
	}
}

function search_timeout_reset() {
	results_div.innerHTML = ""
	more.classList.add("hide")

	clearTimeout(search_timeout)
	search_timeout = setTimeout(run_search, 500)
}

function run_search() {
	var query = input.value
	var qtvec = tvec(parse(query))

	disp.innerHTML = tvecstr(qtvec)

	results = find_similar_query( imagine_idx_entry(qtvec) )

	more.classList.remove("hide")
	add("div", results_div, "<br>SEARCHBOX QUERY:")
	show_more_results(100)
}

function show_more_results(number) {
	if (number > results.length)
		number = results.length

	for (var i = 0; i < number; i++)
		display_result(results.shift())
}

var link_fn = null

function set_link_fn(fn) {
	link_fn = fn
}

// Turn token IDs to words and discard anything that starts with a ▁
function predict_best_pretty(tokens) {
	var words = []

	while (words.length < 50 && tokens.length > 0) {
		var word = tokenizer.convertIdsToTokens( [ tokens.shift().token ] )[0]

		if (word.startsWith("##"))
			continue

		words.push(word)
	}

	return "[ " + words.join(", ") + " ]"
}

function display_result(entry) {
	var details = add("details", results_div)
	var summary = add("summary", details, entry.title)
	var links = add("div", details, link_fn(entry.title))
	var about = add("div", details)
	var description = add("div", about, "Best described with: " + predict_best_pretty(predict_best_query(entry.title)))
	add("br", about)
	var more_tf_idf = add("button", about, "Find similar TF-IDF")
	var more = add("button", about, "Find similar")
	more.classList.add("flr")
	more_tf_idf.classList.add("flr")
	var score = add("div", about, "Score: " + Math.round(entry.score * 100) + "%")
	add("br", about)

	if (entry.is_stray) {
		summary.classList.add("stray")
		summary.title = "At least some of the keywords only implied"
	}

	more.onclick = function() {
		results = find_similar_to(entry.title)
		results_div.innerHTML = ""
		add("div", results_div, "<br>FIND SIMILAR QUERY:")
		show_more_results(100)
	}

	more_tf_idf.onclick = function() {
		results = find_similar_to(entry.title, true)
		results_div.innerHTML = ""
		add("div", results_div, "<br>TF-IDF FIND SIMILAR QUERY:")
		show_more_results(100)
	}
}


//
// EXPRESSION PARSER
//

// Stage 1: search-and-replace simplify
// Stage 2: split by spaces
// Stage 3: extract weights
function parse(expr) {
	var simp_rxp_1 = /\s*\*\s*/g
	var simp_rxp_2 = /-\s*/g
	var simple = expr.replace(simp_rxp_1, "*").replace(simp_rxp_2, "-")

	var tokens = simple.split(" ")
	var vec = {}

	for (var token of tokens) {
		if (token === "") continue

		var k = 1.0 // default k

		if (token.startsWith("-")) {
			k = -k
			token = token.slice(1)
		}

		var pieces = token.split("*")
		var word = token

		if (pieces.length > 1) {
			var kk = parseFloat(pieces[0])

			if ( isNaN(kk) ) {
				// Nothing
			} else {
				pieces.shift()
				word = pieces.join("*")
				k = k * kk
			}
		}

		if (word in vec === false)
			vec[word] = 0.0

		vec[word] += k
	}

	return vec
}

// Takes this:
// { semiconductors: 1, lobsters: -1 }
// Produces this:
// { 2015: 0, 20681: 1, 27940: -1 }
function tvec(vec) {
	var tvec = {}

	for (var word in vec) {
		var weight = vec[word]
		var tokens = tokenizer.tokenize(word)

		for (var token of tokens) {
			token = token + "x" // A hack to preserve ordering

			if (token in tvec === false)
				tvec[token] = 0.0

			tvec[token] += weight
		}
	}
	
	return tvec
}

function tvecstr(vec) {
	var entries = []

	for (var id in vec) {
		entries.push( tokenizer.convertIdsToTokens([parseInt(id)])[0] + ": " + vec[id] )
	}

	return "{ " + entries.join(", ") + " }"
}


//
// SEARCH STARTUP SEQUENCE
//
// Track three XHR downloads
// A little messy
function download_index(url) {
	var done_alerts = 0

	function done_alert() {
		done_alerts++

		if (done_alerts === 3) {
			document.body.children[0].innerHTML = ""
			populate_views()
			build_total_sums()
			init_search()
		}
	}

	var load_fn_1 = function(response) { 
		idx = response
		done_alert()
	}

	var load_fn_2 = function(response) {
		datatape_k = response
		done_alert()
	}

	var load_fn_3 = function(response) {
		datatape_v = response
		done_alert()
	}

	get(url + "/idx.json", load_fn_1, "json")
	get(url + "/datatape_k.bin", load_fn_2, "arraybuffer")
	get(url + "/datatape_v.json", load_fn_3, "arraybuffer")
}
