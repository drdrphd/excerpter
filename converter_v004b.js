///
/// converter.js
/// 
/// much loading code from: https://blog.soshace.com/the-ultimate-guide-to-drag-and-drop-image-uploading-with-pure-javascript/
/// 
/// ms conversion from: https://stackoverflow.com/questions/21294302/converting-milliseconds-to-minutes-and-seconds-with-javascript
/// 

//
// Data loaded in main.html
// from external (transcript_name).js
//
// Data structure:
//
// const tiers = Object {
//		"tier-id": {type: "...", parent_tier: "...", time_alignable: "...", constraints: "..."},
//		"tier-id": {type: "...", parent_tier: "...", time_alignable: "...", constraints: "..."},
//	... };
//
//	Possible values for the above: 	type = LINGUISTIC_TYPE_REF
//									parent_tier = (PARENT_REF, null)
//									time_alignable = (true, false)
//									constraints = (null, Time_subdivision, Symbolic_Subdivision, Symbolic_Association, Included_In)
//
//	const annotations = Object {
// 	  "Tier name": [
// 	        ["annotation id", "parent annotation id", [start_time, end_time], value],
// 	        ["annotation id", "parent annotation id", [start_time, end_time], value],
// 	         ...
// 	   ],
// 	   "Tier name": [ ... ],
//	   "Tier name": [ ... ],
// 	   ...
// 	};

window.onload = function(){
	
	const elan = new WebELAN();
	var time_offset; //assigned after loading
	var preview_checkboxes;	//assigned after loading
	var export_checkboxes;	//assigned after loading
	var toggle_link_mode = false;	//used later for toggling transcript links
	const progress_text = document.getElementById("progress-text");
	
	document.getElementById("start-conversion").addEventListener("click", function(){convertToHTML()});
	document.getElementById("clear-selection").addEventListener("click", function(){clearSelection()});
	document.getElementById("toggle-links").addEventListener("click", function() {
		toggle_link_mode = !toggle_link_mode;
		if (toggle_link_mode) {
			document.getElementById("transcript").addEventListener("click", toggleLinks, true);
			document.getElementById("toggle-links").classList.add("toggle-on");
		} else {
			document.getElementById("transcript").removeEventListener("click", toggleLinks, true);
			document.getElementById("toggle-links").classList.remove("toggle-on");
		}
	});
	
	
	dragAndDropEAF();
	
	
	//
	// DRAG & DROP
	//
	function dragAndDropEAF() {
	
		const dropRegion = document.getElementById("user-input");

		// open file selector when clicked on the drop region
		const hiddenInput = document.createElement("input");
		hiddenInput.type = "file";
		hiddenInput.accept = ".eaf";
		hiddenInput.multiple = false;
		dropRegion.addEventListener('click', function() {
			hiddenInput.click();
		});
		
		//normal file loader is ugly -- keep hidden and just tie to drag and drop
		hiddenInput.addEventListener("change", function() {
			var file = hiddenInput.files[0];
			elan.loadEAF(file)
			.then(function() {
				onLoadEAF();
			})
			.catch(function(error) {
				console.error(error);	//*** to-do: better error handling ***
			});
		});
		
		//don't allow default browser behavior of immediately loading the file
		function preventDefault(e) {
			e.preventDefault();
			  e.stopPropagation();
		}
		dropRegion.addEventListener('dragenter', preventDefault, false);
		dropRegion.addEventListener('dragleave', preventDefault, false);
		dropRegion.addEventListener('dragover', preventDefault, false);
		dropRegion.addEventListener('drop', preventDefault, false);
	
		//handle drag and drop
		function handleDrop(e) {
			var data = e.dataTransfer;
			var file = data.files[0];
			elan.loadEAF(file)
			.then((value) => {
				onLoadEAF();
			})
			.catch(function(error) {
				console.error(error);	//*** to-do: better error handling ***
			});
		}
		dropRegion.addEventListener('drop', handleDrop, false);
	}
	
	
	//
	// SET UP SCREEN & SETUP INPUT FROM TIERS
	//
	function onLoadEAF() {
		document.getElementById("user-input").style.display = "none";
		document.getElementById("info").style.display = "none";
		document.getElementById("results").style.display = "block";
		
		//get time offset for media -- Expand later --
		//if there are more than one media file, there would be multiple files -- this just gets the first
		time_offset = (elan.elan_file.getElementsByTagName("MEDIA_DESCRIPTOR")[0].getAttribute("TIME_ORIGIN") || 0); //default to 0 if undefined
		
		populateTiersSelection()
			.then(function(){
				preview_checkboxes = document.getElementsByClassName("preview-checkbox");
				export_checkboxes = document.getElementsByClassName("export-checkbox");
				for (const ch of preview_checkboxes) {
					ch.addEventListener('click', function(){previewUpdate(ch.value)} );
				}
				for (const ch of export_checkboxes) {
					ch.addEventListener('click', function(){selectionUpdate(ch.value)} );
				}
			}
		);
	}
	
	async function populateTiersSelection() {
		var tiers = elan.tiers;
		
		//create a hierarchical object based on PARENT_REF
		var hierarchy = {};
		tiers.forEach(tier => {
			var parent_ref = tier.getAttribute("PARENT_REF");
			if (!hierarchy[parent_ref]) {
				hierarchy[parent_ref] = [];
			}
			hierarchy[parent_ref].push(tier);
		});
		
		//grab top-level tiers for preview chekboxes
		var checkbox_HTML = "<ul>";
		hierarchy[null].forEach(tier => {
			checkbox_HTML +=
				'<li><input type="checkbox" class="preview-checkbox" id="' + tier.getAttribute("TIER_ID")
						+ '" value="' + tier.getAttribute("TIER_ID") + '"/>'
				+ '<label for="' + tier.getAttribute("TIER_ID") + '">'
					+ tier.getAttribute("LINGUISTIC_TYPE_REF")	//tier type
					+ " [" + tier.children.length + "] - "	//[number of annotations]
					+ tier.getAttribute("TIER_ID")		//tier name
				+ "</label>"
				+ '<input type="text" title="Speaker Initials" class="input-initials" placeholder="Initials" for="' + tier.getAttribute("TIER_ID") + '"/>'
				+ "</li>";
		});
		checkbox_HTML += "</ul>";
		document.getElementById("preview-tiers").innerHTML = checkbox_HTML;
		
		//parse Object into nested HTML checkboxes
		function addExportTiers(par = null) {
			var child_tiers = hierarchy[par] || [];	//child_tiers might be undefined
			if (child_tiers.length == 0) return '';
			
			var checkbox_HTML = "<ul>";
			child_tiers.forEach(tier => {
				checkbox_HTML +=
					'<li class="preview-list"><input type="checkbox" class="export-checkbox" id="ex-'
							+ tier.getAttribute("TIER_ID")
							+ '" value="' + tier.getAttribute("TIER_ID") + '"/>'
					+ '<label for="ex-' + tier.getAttribute("TIER_ID") + '">'
						+ tier.getAttribute("LINGUISTIC_TYPE_REF")	//tier type
						+ " [" + tier.children.length + "] - "	//[number of annotations]
						+ tier.getAttribute("TIER_ID")		//tier name
					+ "</label>"
					+ addExportTiers(tier.getAttribute("TIER_ID"))
					+ "</li>";
			});
			checkbox_HTML += "</ul>";
			return checkbox_HTML;
		}
		//hide only the top-level tiers and then copy over to display
		var new_div = document.createElement("div");
		new_div.innerHTML = addExportTiers();
		for (var i of new_div.children[0].children) i.hidden = true;
		document.getElementById("export-tiers").innerHTML = new_div.innerHTML;
	}
	
	
	//update preview field after preview-checkbox checked/unchecked
	function previewUpdate(changed) {
		const preview_LIs = document.getElementsByClassName("preview-list");
		var checked_tiers = [];
		
		//figure out which preview-checkboxes remain checked
		//and make the corresponding export tiers visible/invsible
		for (var i=0; i < preview_checkboxes.length; i++) {
			if (preview_checkboxes[i].checked) {
				//make the related export tiers visible
				for (var j=0; j < preview_LIs.length; j++) {
					if (preview_LIs[j].firstChild.value == preview_checkboxes[i].value) {
						preview_LIs[j].hidden = false;
						//and make them checked
						var child_inputs = preview_LIs[j].getElementsByTagName("INPUT");
						for (var k=0; k < child_inputs.length; k++) {
							child_inputs[k].checked = true;
						}
					}
				}
				//get tier contents and send to preview
				for (var j=0; j < elan.tiers.length; j++) {
					if (elan.tiers[j].getAttribute("TIER_ID") == preview_checkboxes[i].value) {
						checked_tiers.push(elan.tiers[j]);
					}
				}
			//or, if unchecked
			} else {
				//make the related export tiers invisible
				for (var j=0; j < preview_LIs.length; j++) {
					if (preview_LIs[j].firstChild.value == preview_checkboxes[i].value) {
						preview_LIs[j].hidden = true;
						//and uncheck them
						var child_inputs = preview_LIs[j].getElementsByTagName("INPUT");
						for (var k=0; k < child_inputs.length; k++) {
							child_inputs[k].checked = false;
						}
					}
				}
			}
		}
		displayTierText(checked_tiers, document.getElementById("preview"));
	}
	
	//after a box has been checked
	//check parent/child boxes
	//if parent is unchecked, uncheck all children
	//if child is checked, make sure all parents are checked
	function selectionUpdate(changed) {
		//recursively find parent tiers
		function updateParents(changed) {
			var tier;
			for (var i=0; i < elan.tiers.length; i++) {
				var t = elan.tiers[i];
				if (t.getAttribute("TIER_ID") == changed) {
					tier = t;
					break;
				}
			}
			var par = tier.getAttribute("PARENT_REF");
			if (par !== null) {
				export_checkboxes["ex-" + par].checked = true;
				updateParents(par);
			}
		}
		//update based on checked tiers
		if (export_checkboxes["ex-" + changed].checked) {
			updateParents(changed);
		} else {
			var child_inputs = export_checkboxes["ex-" + changed].parentElement.getElementsByTagName("INPUT");
			for (var i=0; i < child_inputs.length; i++) {
				child_inputs[i].checked = false;
			}
		}
	}
	
	//Preview (and interleave by time) top-level tiers for selection
	function displayTierText(tiers, target_div) {
		target_div.innerHTML = ""; //reset
		
		var transcriptions = [];
		var times_annotations = [];
		for (var i = 0; i < tiers.length; i++) {
			transcriptions.push(elan.annotations(tiers[i]));
		}		
		for (var i = 0; i < transcriptions.length; i++) {
			for (var j = 0; j < transcriptions[i].length; j++){
				times_annotations.push(
					[elan.getId(transcriptions[i][j]),		//annotation id
					 elan.getTimes(transcriptions[i][j]),	//annotation times [start,end]
					 elan.value(transcriptions[i][j])]		//annotation value
				);
			}
		}
		times_annotations.sort((a,b) => (+a[1][0] - +b[1][0]));
		times_annotations.forEach((a) => {
			target_div.innerHTML += 
				("<div class='transcript-line'"
				 + "id='preview-" + a[0] + "' data-start='" + a[1][0] + "' data-end='" + a[1][1] + "'>"
				 + "<small>"+ msToMinSec(a[1][0]) + "&emsp;</small>" + a[2] + "</div>");
		});
		const lines = document.getElementsByClassName("transcript-line");
		for (var t of lines) {
			t.addEventListener('click', 
				function(e){
					e.target.classList.toggle("selected-line");
					if (document.getElementsByClassName("selected-line").length > 0) 
						document.getElementById("start-conversion").disabled = false;
					else
						document.getElementById("start-conversion").disabled = true;
					});
		}
	}
	
	//Clear Selection
	//Clears the selected transcript lines by removing class "selected-line"
	//and disables the start button
	function clearSelection() {
		var selected = document.getElementsByClassName("selected-line");
		while (selected[0])  selected[0].classList.toggle("selected-line");	//remove all
		document.getElementById("start-conversion").disabled = true;
	}
	
	//Once HTML preview is in place...
	//use toolbar to toggle links on tanscription-block divs
	function toggleLinks(e) {
 		//remove link
		if (toggle_link_mode && e.target.tagName.toLowerCase() === 'a') {
			e.preventDefault();
			var href = e.target;
			var par = href.parentNode;
			par.replaceChild(document.createTextNode(href.textContent), href);
			document.getElementById("export-html").innerText = document.getElementById("transcript").innerHTML;
		//add link on <div class='transcription-block'>
		} else if (toggle_link_mode && e.target.nodeType === Node.ELEMENT_NODE) {
			var div_text = e.target.innerHTML; 	// Use the div text as link HREF
			div_text = div_text.replaceAll("&#60;","-").replaceAll("&#62;","-");	//account for <in>, <um>
			div_text = div_text.replaceAll("&lt;","-").replaceAll("&gt;","-");		//account for <in>, <um>
			e.target.innerHTML = `<a href="` + div_text + `">` + div_text + "</a>";
			document.getElementById("export-html").innerText = document.getElementById("transcript").innerHTML;
		}
	}
	
	
	//
	// ELAN FILE PROCESSES
	//
	async function convertToHTML() {
		//collect info
		var tiers, annotations, download_name;
		var selected_tiers = document.getElementById("export-tiers").querySelectorAll('input:checked'); //[HTML nodes]
		var selected_tier_names = [...selected_tiers].map((e)=>e.id.substring(3));	//just the names
		var selected_lines = document.getElementById("preview").getElementsByClassName('selected-line');
		var selected_annotations = [];
		for (var a of selected_lines) selected_annotations.push(a.id.substring(8));  //annotation id (- "preview-")
	
		if (selected_lines.length == 0) {
			progress_text.innerHTML = "Please select at least one line in 'Preview'" + progress_text.innerHTML;
			return;
		} else 
			progress_text.innerHTML = "Converting ELAN to JS Array . . ." + progress_text.innerHTML;
		
		//copy data to Export box
		document.getElementById("export-start-time").innerHTML = (+selected_lines[0].getAttribute("data-start") + (+time_offset));	//TO DO -- checkbox for using time offsets instead of hardcoding
		document.getElementById("export-end-time").innerHTML = (+selected_lines[selected_lines.length-1].getAttribute("data-end") + (+time_offset));	//TO DO -- checkbox for using time offsets instead of hardcoding
		
		//get ELAN excerpt data
		var elan_export = elan.exportExcerptForViewer(selected_tier_names, selected_annotations);
		tiers = elan_export[0];
		annotations = elan_export[1];
		download_name = elan_export[2];
		if (download_name.substring(download_name.length - 4) == ".eaf")
				download_name = download_name.substring(0,download_name.length - 4);
		
		progress_text.innerHTML += " Done";
		
		//produce blocks
		loadTranscriptions(tiers, annotations)
			.then(function(){
				//copy to export HTML
				document.getElementById("export-html").innerText = document.getElementById("transcript").innerHTML;
				//enable button
				document.getElementById("transcript-download").addEventListener('click', function(){
					var download_content =
						"start:" + document.getElementById("export-start-time").innerHTML + ";"
						+ "end:" + document.getElementById("export-end-time").innerHTML + ";"
						+ "html:" + document.getElementById("transcript").innerHTML + ";"
					var blob = new Blob([download_content], {type: 'text/javascript;charset=utf-8;'});
					var url = URL.createObjectURL(blob);
					var download_link = document.createElement('a');
					download_link.href = url;
					download_link.setAttribute('download', download_name + ".txt");
					download_link.click();
				});
				document.getElementById("transcript-download").disabled = false;
			});
	}
	
	
	
	//
	// loadTranscriptions(Object, Object)
	//
	// Takes an array of Tier objects and lays out the tiers, tier names, and content blocks
	//
	// This function can take a LONG time for longer transcripts (even 15 min)
	// So uses an async and await to add small pauses, allowing the browser to refresh
	// This lets the already prepared transcriptions start filling the transcription
	//
	async function loadTranscriptions(tiers, annotations) {
		document.getElementById("loading").style.display = "inline";
		
		//where to put the blocks
		//put here temporarily so we can re-order them before displaying
		const transcript = document.getElementById("transcript");
		transcript.innerHTML = "";
		
		//for displaying updates
		progress_text.innerHTML = "Parsing top-level tiers. . .<br />" + progress_text.innerHTML;
		
		//get ordered tiers -- (x in Object) does not preserve order
		var htiers = Object.keys(tiers);	//tiers are pre-sorted into a hierarchy when exported
		
		//get line initials, creating an Object of {tier_name:input-initials,...}
		var initials = Object.fromEntries(
			[...document.getElementsByClassName("input-initials")].map((x) => [x.getAttribute('for'),x.value]) );
		
		// Top-Level Tiers first
		// we'll collect all the annotations on relevant tiers and then sort by time & display
		// go through all tiers
		for (var r in htiers) {
			t = htiers[r];
			//get top-level tiers
			if ( tiers[t].parent_tier === null ) {
				//get the annotations
				var tier_annotations = annotations[t];
				for (var i = 0; i < tier_annotations.length; i++) {
					var a = tier_annotations[i];	//[a_id, par_id, [start,end], value]
					
					//create elements and arrange
					const new_line = document.createElement("div");
					const new_line_info = document.createElement("div");
					const new_time = document.createElement("div");
					var new_t = document.createElement("div");
					
					new_line.classList.add("transcription-line");
					new_line.id = "line-" + a[0];	//each annotation has its own ID
					new_line.setAttribute("data_start", a[2][0]);
					new_line.setAttribute("data_end", a[2][1]);
					
					new_line_info.classList.add("transcription-line-info");
					new_time.classList.add("transcription-time");
					new_time.innerHTML = msToMinSec(a[2][0]);
					new_line_info.appendChild(new_time);
					
					if (initials[t] !== 'undefined' && initials[t].length > 0) {
						const new_initials = document.createElement("div");
						new_initials.classList.add("transcription-initials");
						new_initials.innerHTML = initials[t];
						new_line_info.appendChild(new_initials);
					}
					
					new_t.id = a[0];
					new_t.classList.add("transcription-block");
					new_t.classList.add(tiers[t].type);
					new_t.innerHTML = a[3].replaceAll("<","&#60;").replaceAll(">","&#62");
					
					//add stack to keep child elements aligned
					var new_stack = document.createElement("div");
					new_stack.classList.add("transcription-stack");
					new_stack.id = "st-" + a[0];	//each annotation has its own ID
					new_stack.appendChild(new_t);
					
					//build line
					new_line.appendChild(new_line_info);
					new_line.appendChild(new_stack);
					transcript.appendChild(new_line);
					//pause a moment to refresh so page appears active
					await timer(1);
				}
			}
		}

		progress_text.innerHTML = "Re-Ordering top-level tiers. . .<br />" + progress_text.innerHTML;
		//order the divs by custom "data_start" attribute
		var lines = [...document.getElementsByClassName("transcription-line")];
		lines.sort((a,b) => (+a.getAttribute("data_start") - +b.getAttribute("data_start")) );
		document.getElementById("transcript").innerHTML = "";
		for (var i=0; i < lines.length; i++) {
			document.getElementById("transcript").appendChild(lines[i]);
			// eval('document.getElementById("' + lines[i].id + '").addEventListener("click", () => {'
				// + 'audio.currentTime = (' + lines[i].getAttribute("data_start") + ')/1000;'
				// + 'audio.play();'
				// + '});');
		}

		
		progress_text.innerHTML = "Parsing sub-tiers. . .<br />"  + progress_text.innerHTML;
		//Sub-Tiers next
		//go through all tiers
		for (var j in htiers) {
			progress_text.innerHTML = "Tier " + j + " of " + htiers.length + "<br />" + progress_text.innerHTML;
			var t = htiers[j];
			//get lower-level tiers
			if ( tiers[t].parent_tier !== null  ) {
				//get the annotations of that tier
				a = annotations[t];
				for (var i = 0; i < a.length; i++) {
					//create elements and arrange
					var parent_id = a[i][1];
					var par_div = document.getElementById(parent_id);
					
					var new_t = document.createElement("div");
					new_t.innerHTML = a[i][3].replaceAll("<","&#60;").replaceAll(">","&#62;");
					if (tiers[t].type == "Morphemes") {
						var lnk = new_t.innerHTML;
						lnk = lnk.replaceAll("&#60;","-").replaceAll("&#62;","-");	//account for <in>, <um>
						lnk = lnk.replaceAll("&lt;","-").replaceAll("&gt;","-");	//account for <in>, <um>	<-- weird HTML render thing??
						if ( (lnk[0] != '"' && lnk[lnk.length-1] != '"' )	//skip anything in quotes
							&& (!lnk.includes("~")) )						//and anything with a ~ (these don't have diksionariu.com entries)
							new_t.innerHTML = `<a href="` + lnk + `">` + new_t.innerHTML + "</a>";	//HACKY, MAKE MORE ROBUST LATER
					}
					new_t.classList.add("transcription-block");
					new_t.classList.add(tiers[t].type);
					new_t.id = a[i][0];		//each annotation has its own ID
					
					if (tiers[t].constraints == "Symbolic_Association") {	//1-to-1
						if (par_div.getAttribute("class").includes("transcription-block"))
							par_div.parentElement.appendChild(new_t);
						else
							par_div.appendChild(new_t);
						
					} else {
						//add stack to keep child elements aligned
						var new_stack = document.createElement("div");
						if (! par_div.parentElement.getAttribute("class").includes("time-aligned-stack")) {
							new_stack.classList.add("time-aligned-stack");
							new_stack.id = "st-" + a[i][0];	//each annotation has its own ID
							new_stack.appendChild(new_t);
							
						} else {	//"class" == "time-aligned-stack"
							if (par_div.parentNode.childNodes.length == 1) {	//no other annotations yet (childNodes includes parent??)
								new_stack.classList.add("time-aligned-substack");
								new_stack.id = "sub-" + par_div.id;
								
								const sub_stack = document.createElement("div");
								sub_stack.classList.add("time-aligned-stack");
								sub_stack.id = "st-" + a[i][0];	//each annotation has its own ID
								sub_stack.appendChild(new_t);
								new_stack.appendChild(sub_stack);
							} else {	//other annotations of parent
								const sub_stack = document.getElementById("sub-" + par_div.id);
								new_stack.classList.add("time-aligned-stack");
								new_stack.id = "st-" + a[i][0];	//each annotation has its own ID
								new_stack.appendChild(new_t);
								sub_stack.appendChild(new_stack);
								new_stack = sub_stack;
							}
						}
						
						par_div.parentElement.appendChild(new_stack);
					}
					
					//pause a moment to refresh so page appears active
					await timer(1);
				}
			}
		}
		
		document.getElementById("loading").style.display = "none";
		progress_text.innerHTML = "Done<br />" + progress_text.innerHTML;
		document.getElementById("transcript-download").disabled = false;
	}
	
	
	
	// 
	// timer(Numeric)
	//
	// Returns a Promise that resolves after "ms" Milliseconds
	//
	function timer(ms) {
		return new Promise(res => setTimeout(res, ms));
	}


	//
	// hasChildOfType(String, String)
	//
	// Returns a Boolean whether any children down the hierarchy are of the given type
	//
	function hasChildOfType(tier_name, type) {
		var child_tiers = getChildTiers(tier_name);
		var children_of_type = false;
		
		if (child_tiers.length == 0) {	//no children, return false
			return false;
		}
		for (var t in tiers) {
			for (var i = 0; i < child_tiers.length; i++) {
				if (t == child_tiers[i]  &&  tiers[t].type == type) {	//at least one matching child
					return true;
				}
			}
		}
		for (var i = 0; i < child_tiers.length; i++) {
			if(hasChildOfType(child_tiers[i], type)) {	//check further descendants
				children_of_type = true;
			}
		}
		return children_of_type;
	}
	
	
	//
	// getChildTiers(String)
	//
	// Returns an array of Strings (tier-id) having the current Tier as a parent
	//
	function getChildTiers(tier_id) {
		var child_tiers = [];
		
		for (var t in tiers) {
			if (tiers[t].parent_tier !== null
				&& tiers[t].parent_tier == tier_id) { //get the tier if it has this one as its parent
				child_tiers.push(t);
			}
		}
		return child_tiers;
	}
	
	
	//
	// getSiblings(String, Array)
	//
	// Returns an array of annotation-ids for siblings to the current annotation
	//
	function getSiblings(annotations, tier_id, annotation_data) {		
		var siblings = [];
		
		var a = annotations[tier_id];
		for (var i = 0; i < a.length; i++) {
			if (a[i][1] == annotation_data[1])
				siblings.push(a[i][0]);
		}
		return siblings;
	}
	
	//
	// msToMinSec(int)
	//
	// Converts milliseconds to Minute:Second (mm:ss) display times
	// taken from: https://stackoverflow.com/questions/21294302/converting-milliseconds-to-minutes-and-seconds-with-javascript
	//
	function msToMinSec(ms) {
		var minutes = Math.floor(ms / 60000);
		var seconds = ((ms % 60000) / 1000).toFixed(0);
		return (seconds == 60 ? (minutes+1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
	}	
}