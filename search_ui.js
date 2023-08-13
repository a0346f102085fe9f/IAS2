"use strict";

var tokenizer = new BertTokenizer()

var ui = {

}

var results = []
var search_timeout = -1

function add_radio(parent, caption, name, value, checked = false) {
	var label = add("label", parent)
	var input = add("input", label)
	var div = add("div", label)

	input.checked = checked
	input.type = "radio"
	input.name = name
	input.value = value
	div.innerHTML = caption

	return label
}

var size_preference_fns = {
	"none": null,
	"short": prefer_shorter_fn,
	"long": prefer_longer_fn
}

function ui_init() {
	var main = document.querySelector("main")
	var log = document.querySelector(".log")

	log.classList.add("log_hide")

	// Searchbox
	ui.input = add("input", main)
	ui.input.type = "text"
	ui.input.placeholder = "Search..."
	ui.input.oninput = search_timeout_reset

	// Token display
	ui.disp = add("div", main, "Protip: syntax like <kbd>-word, 5*word, -5*word</kbd> supported.")
	ui.disp.classList.add("tokens")

	// Preferences
	ui.advanced = add("details", main)
	ui.advanced.classList.add("advanced")

	add("summary", ui.advanced, "Advanced...").classList.add("secondary")

	ui.preferences = add("form", ui.advanced)
	ui.preferences.onchange = run_search

	var fieldset = add("fieldset", ui.preferences)

	add("legend", fieldset, "<b>Size preference:</b>")

	add_radio(fieldset, "No preference", "size_preference", "none", true)
	add_radio(fieldset, "Short stories", "size_preference", "short")
	add_radio(fieldset, "Long stories", "size_preference", "long")

	ui.results = add("div", main)
	ui.results.classList.add("search_results")

	ui.more = add("button", main, "Show 100 more")
	ui.more.classList.add("hide")
	ui.more.onclick = function() {
		show_more_results(100)
	}
}

function search_timeout_reset() {
	ui.results.replaceChildren()
	ui.more.classList.add("hide")

	clearTimeout(search_timeout)
	search_timeout = setTimeout(run_search, 500)
}

function run_search() {
	var query = ui.input.value
	var {weights, order} = produce_token_weights(parse(query))

	ui.disp.innerHTML = display_weights_str(weights, order)

	if (!ensure_rows(weights))
		return

	results = strict_intersect_query(weights, size_preference_fns[ui.preferences["size_preference"].value])

	ui.more.classList.remove("hide")
	ui.results.replaceChildren()
	add("div", ui.results, results.length + " RESULTS:").classList.add("query_stats")
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
	var details = add("details", ui.results)
	var summary = add("summary", details, entry.title)
	var links = add("div", details, link_fn(entry.title))
	var about = add("div", details)

	add("br", about)
	add("div", about, "Score: " + Math.round(entry.score * 100) + "%")

	if (entry.is_stray) {
		summary.classList.add("stray")
		summary.title = "At least some of the keywords only implied"
	}
}


//
// EXPRESSION PARSER
//

// Returns word weights
// Words may split into >1 tokens later
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

// Takes word weights:
// { semiconductors: 1, lobsters: -1 }
// Produces token weights:
// {
//	weights: { 2015: 1, 20681: 1, 27940: -1 },
//	order: [ 2015, 20681, 27940 ]
// }
//
function produce_token_weights(vec) {
	var weights = {}
	var order = []

	for (var word in vec) {
		var weight = vec[word]
		var tokens = tokenizer.tokenize(word)

		for (var token of tokens) {
			if (token in weights === false) {
				weights[token] = 0.0
				order.push(token)
			}

			weights[token] += weight
		}
	}

	return { weights, order }
}

function display_weights_str(weights, order) {
	var entries = []

	for (var id of order) {
		var word = tokenizer.tokenizer.vocab[id].replace("##", "_")

		entries.push(word + ": " + weights[id])
	}

	return "{ " + entries.join(", ") + " }"
}
