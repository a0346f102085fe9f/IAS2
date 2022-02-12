"use strict";

var log = console.log
var error = console.error

function add(tag, parent = document.body, html = "") {
	var element = document.createElement(tag)
	element.innerHTML = html
	parent.append(element)

	return element
}

function get(address, callback_ready, type = "text") {
	var xhr = new XMLHttpRequest();
	var statusbox = add("pre", document.body.children[0])

	function show_status(text) {
		statusbox.innerText = text
	}

	xhr.onload = async function() {
		if (xhr.status >= 400) {
			show_status("Server error: " + xhr.status)
		} else {
			callback_ready(xhr.response)
		}
	}

	xhr.onprogress = function(event) {
		show_status("Downloading [" + address + "]:\t" + Math.round(event.loaded / event.total * 100) + "%\t" + Math.round(event.loaded / 1024) + "KB")
	}

	xhr.onerror = function(event) {
		show_status("Network error!")
	}

	xhr.open('GET', address, true);
	//xhr.overrideMimeType("application/json");
	xhr.responseType = type
	xhr.send(null);
}
