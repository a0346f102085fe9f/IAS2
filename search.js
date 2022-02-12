"use strict";

var tokenizer = new BertTokenizer()

var input = null
var disp1 = null
var disp2 = null
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

	disp1 = add("div", main, "[ Token IDs ]")
	disp2 = add("div", main, "[ Token text ]")
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
	var tokens = tokenizer.tokenize(input.value)

	disp1.innerHTML = "[ " + tokens.join(", ") + " ]"
	disp2.innerHTML = "[ " + tokenizer.convertIdsToTokens(tokens).join(", ") + " ]"

	results = find_similar_query(tokens)

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

function display_result(entry) {
	var entry_div = add("div", results_div)
	var score = add("div", entry_div)
	var rxp = /-(.+)\.txt$/

	var id = rxp.exec(entry.title)[1]
	var link = add("a", entry_div, entry.title)

	link.href = "https://poneb.in/" + id

	entry_div.classList.add("search_result")
	score.classList.add("flr")
	score.classList.add("clickable")

	score.innerHTML = Math.round(entry.score * 100) + "%"

	score.onclick = function() {
		results = find_similar_to(entry.title)
		results_div.innerHTML = ""
		add("div", results_div, "<br>FIND SIMILAR QUERY:")
		show_more_results(100)
	}
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
