"use strict";

var log = console.log
var error = console.error
var queue = queueMicrotask ?? function(fn) { setTimeout(fn, 0) }

function add(tag, parent = document.body, html = "") {
	var element = document.createElement(tag)
	element.innerHTML = html
	parent.append(element)

	return element
}

// Download + retry on error
// type: json, text, blob, arraybuffer
function get(address, callback_ready, type = "blob") {
	var statusbox = add("tr", document.querySelector(".log"))

	var show_status = function(html) {
		statusbox.innerHTML = "<td>Downloading [" + address + "]:</td>" + html
	}

	_get(address, callback_ready, type, show_status)
}

function _get(address, callback_ready, type, show_status) {
	var xhr = new XMLHttpRequest();

	xhr.onload = async function(event) {
		var kilobytes = Math.round(event.loaded / 1024)

		if (xhr.status >= 500) {
			show_status("<td>Server error: " + xhr.status + "; retrying in 10s</td><td>---</td>")

			// Frantically bashing an overloaded server will not help
			// So retry in 10s unlike 3s for network errors
			setTimeout(_get, 10000, address, callback_ready, type, show_status)
		} else if (xhr.status >= 400) {
			// No point in retrying on 404 or 403
			show_status("<td>Server error: " + xhr.status + "; no retry</td><td>---</td>")
		} else {
			show_status("<td>100%</td><td>" + kilobytes + "KB</td>")
			callback_ready(xhr.response)
		}
	}

	xhr.onprogress = function(event) {
		var progress = "---"
		var kilobytes = Math.round(event.loaded / 1024)

		if (event.total)
			progress = Math.round(event.loaded / event.total * 100)

		show_status("<td>" + progress + "%</td><td>" + kilobytes + "KB</td>")
	}

	xhr.onerror = function(event) {
		show_status("<td>Network error! Retrying in 3s...</td><td>---</td>")

		// No harm done in retrying a lot if there's no network
		setTimeout(_get, 3000, address, callback_ready, type, show_status)
	}

	xhr.open('GET', address, true);
	//xhr.overrideMimeType("application/json");
	xhr.responseType = type
	xhr.send(null);

	show_status("<td>---%</td><td>Awaiting first bytes of data...</td>")
}
