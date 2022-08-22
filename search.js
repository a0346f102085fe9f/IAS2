"use strict";

var tokenizer = new BertTokenizer()

var input = null
var disp_required_set = null
var disp_required_txt = null
var disp_rejected_set = null
var disp_rejected_txt = null
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

	disp_required_set = add("div", main, "[ Token IDs ]")
	disp_required_txt = add("div", main, "[ Token text ]")
	disp_rejected_set = add("div", main, "[ Rejected token IDs ]")
	disp_rejected_txt = add("div", main, "[ Rejected token text ]")

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
	var rejected_words_rxp = /-\S+/g
	var rejected_word_arr = []
	var query = input.value

	function rejected_words_fn(match) {
		rejected_word_arr.push(match.slice(1))
		return ""
	}

	query = query.replace(rejected_words_rxp, rejected_words_fn).trim()

	var required = tokenizer.tokenize(query)
	var rejected = []

	if (rejected_word_arr.length > 0)
		rejected = tokenizer.tokenize(rejected_word_arr.join(" "))

	disp_required_set.innerHTML = "[ " + required.join(", ") + " ]"
	disp_required_txt.innerHTML = "[ " + tokenizer.convertIdsToTokens(required).join(", ") + " ]"
	disp_rejected_set.innerHTML = "[ " + rejected.join(", ") + " ]"
	disp_rejected_txt.innerHTML = "[ " + tokenizer.convertIdsToTokens(rejected).join(", ") + " ]"

	results = find_similar_query( imagine_idx_entry(required, rejected) )

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

function display_result(entry) {
	var details = add("details", results_div)
	var summary = add("summary", details)

	var link = add("a", summary, entry.title)

	link.href = link_fn(entry.title)

	var about = add("div", details)

	var description = add("div", about, "Best described with: " + predict_best_query(entry.title))
	add("br", about)
	var more_tf_idf = add("button", about, "Find similar TF-IDF")
	var more = add("button", about, "Find similar")
	more.classList.add("flr")
	more_tf_idf.classList.add("flr")
	var score = add("div", about, "Score: " + Math.round(entry.score * 100) + "%")
	add("br", about)

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
