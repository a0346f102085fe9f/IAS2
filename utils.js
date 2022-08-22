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
	var statusbox = add("tr", document.body.children[0])

	function show_status(text) {
		statusbox.innerHTML = text
	}

	xhr.onload = async function(event) {
		var kilobytes = Math.round(event.loaded / 1024)

		if (xhr.status >= 400) {
			show_status("<td>Downloading [" + address + "]:<td><td>Server error: " + xhr.status + "</td><td>---</td>")
		} else {
			show_status("<td>Downloading [" + address + "]:</td><td>100%</td><td>" + kilobytes + "KB</td>")
			callback_ready(xhr.response)
		}
	}

	xhr.onprogress = function(event) {
		var progress = "---"
		var kilobytes = Math.round(event.loaded / 1024)

		if (event.total)
			progress = Math.round(event.loaded / event.total * 100)

		show_status("<td>Downloading [" + address + "]:</td><td>" + progress + "%</td><td>" + kilobytes + "KB</td>")
	}

	xhr.onerror = function(event) {
		show_status("<td>Downloading [" + address + "]:<td><td>Network error!</td><td>---</td>")
	}

	xhr.open('GET', address, true);
	//xhr.overrideMimeType("application/json");
	xhr.responseType = type
	xhr.send(null);

	show_status("<td>Downloading [" + address + "]:</td><td>---%</td><td>Awaiting first bytes of data...</td>")
}
