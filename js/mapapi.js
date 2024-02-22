const DISTRICT = 'SPK';
const CDA_BASE = 'https://cwms-data.usace.army.mil/cwms-data';
// An ArcGIS key is only required if you want to use ArcGIS/ESRI maps.
const GIS_API_KEY = '<your API key here>';

/*
 The id of the <div> element that the plot will be drawn on.
 This is hardcoded for a single plot, but multiple can be used
 by changing the onload event, and explicitly calling buildPlotlyMap
 with different ids.
*/
const PLOT_ID = "map";

/* 
 These dimensions assume a square chart.
 They are adjusted based on the actual aspect ratio of the chart.
*/
const SUBPLOT_WIDTH = 0.075;
const SUBPLOT_HEIGHT = 0.10;

const ASPECT_RATIO_PORTRAIT = {w: 1, h: 1.348684};  // Aspect ratio for map (so it prints on 8.5x11 paper)
const ASPECT_RATIO_LANDSCAPE = {w: 1.348684, h: 1}; // This should match the aspect ratio of the width and height defined in the CSS.

// The geo map offsets the Y values, why?
const GEO_MAP_OFFSET = 50;

// Choose colors at https://www.w3schools.com/colors/colors_picker.asp
// To use the plotly default, just set the value to null: e.g. `ANNOTATION: null,`
const COLOR = {
	MARKER_COE: 'rgb(255,77,77)',
	MARKER_SC7: 'rgb(77,148,255)',
	MARKER_LINE: 'rgb(0,0,0)',
	TOC: 'rgb(255,0,0)',
	POOL: 'rgb(255,204,102)',
	STORAGE: 'rgb(0,64,255)',
	MISSING: 'rgb(148,77,255)',
	ANNOTATION: 'rgba(255,255,255,0.66)',
}

var CHART_BASE_CONFIG = 
{
	map: 'mapbox',                             // Can use 'geo' or 'mapbox'
	style: 'open-street-map',
	layers: null,
	location: {
		ca: {
			subtitle: 'California Projects',   // Subtitle, appears as suffix on the plot title
			center: {
				lat: 38.465,
				lon: -121.236
			},
			zoom: 5.5,                         // For mapbox, map zoom level
			range: {
				lon: 10,                       // For geo map, longitude width of view
				lat: 11.8,                     // For geo map, latitude height of view
			},
			tz: 'America/Los_Angeles',
		},
		gb: {
			subtitle: 'Utah Great Basin',      // Subtitle, appears as suffix on the plot title
			center: {
				lat: 40.852,
				lon: -111.633
			},
			zoom: 8,                           // For mapbox, map zoom level
			range: {
				lon: 3.23,                     // For geo map, longitude width of view
				lat: 1.5,                      // For geo map, latitude height of view
			},
			tz: 'America/Denver',
			landscape: true,                   // The map should be drawn in landscape, instead of portrait.
		},
		uc: {
			subtitle: 'Upper Colorado',        // Subtitle, appears as suffix on the plot title
			center: {
				lat: 38.96,
				lon: -108.36
			},
			zoom: 6.5,                         // For mapbox, map zoom level
			range: {
				lon: 10.1,                     // For geo map, longitude width of view
				lat: 5,                        // For geo map, latitude height of view
			},
			tz: 'America/Denver',
			landscape: true,                   // The map should be drawn in landscape, instead of portrait.
		},
	},
	unavailable_text: 'Unavailable',           // Text shown in place of missing data values
	na_text: 'N/A',                            // Text shown when data is display which doesn't apply (such as TOC for non-FRM reservoirs)

	// This is the popup text that appears when the mouse moves over a point on the map
	map_hovertemplate: `<b>%{text}%{meta.dam}</b><br>
	<em>Gross Pool Storage:</em> %{meta.gross_stor:,.0f} %{customdata.gross_stor_units}<br>
	<em>Current Storage:</em> %{customdata.stor} %{customdata.stor_units}<br>
	<em>Top of Conservation:</em> %{customdata.toc} %{customdata.toc_units}<br>
	<br>
	<em>Gross Pool Elevation:</em> %{meta.gross_elev:,.2f} %{customdata.gross_elev_units}<br>
	<em>Current Elevation:</em> %{customdata.elev} %{customdata.elev_units}<br>
	<br>
	<em>Capacity Filled:</em> %{customdata.fill}<br>`
};

const MAPS = {
	'open-street-map-bicycle': {
		sources: [
			'http://a.tile.thunderforest.com/cycle/{z}/{x}/{y}.png',
			'http://b.tile.thunderforest.com/cycle/{z}/{x}/{y}.png',
			'http://c.tile.thunderforest.com/cycle/{z}/{x}/{y}.png',
		]
	}
}

const STOR_NFORMAT = new Intl.NumberFormat(undefined, {notation: 'standard', maximumFractionDigits: 0});
const NFORMAT = new Intl.NumberFormat(undefined, {notation: 'standard', maximumFractionDigits: 2});
const PFORMAT = new Intl.NumberFormat(undefined, {style: 'percent', maximumFractionDigits: 0});

/***************************************
 Start of code
 ***************************************/
var addedLines = false;

function range(size, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

// https://builtin.com/software-engineering-perspectives/javascript-sleep
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

function toggleLoading(plot_id, show) {
	let wheel = 'hidden';
	let plot = 'visible';

	if(show) {
		wheel = 'visible';
		plot = 'hidden';
	}
	document.getElementById('loader').style.visibility = wheel;
	document.getElementById(plot_id).style.visibility = plot;
}

async function getGeoJSON(filename = "") {
	if( filename.indexOf('/') >= 0 || filename.indexOf('\\') >= 0 ) {
		throw new Error('filename argument must not contain a path!');
	}
	const res = await fetch("/extra/" + filename, {
		headers: {
			"Content-Type": "application/json",
		}
	});

	return res.json();
}

async function getTimeseriesCDA(pathname, date, tz) {
	let begin = new Date(date);
	begin.setDate(begin.getDate() - 7);

	const URL_TEMPLATE = `${CDA_BASE}/timeseries?name=${encodeURIComponent(pathname)}&begin=${encodeURIComponent(begin.toISOString().split('Z')[0])}&end=${encodeURIComponent(date.toISOString().split('Z')[0])}&office=${DISTRICT}&timezone=${encodeURIComponent(tz)}&page-size=10`

	// Undefined means the TS path wasn't set in the CSV, this shows "N/A" in the popup.
	const UNDEF_VALUE = {
		"datetime": 0,
		"value": undefined,
		"datetime-previous": null,
		"value-previous": undefined,
		"units": null,
	};

	// Normal error condition, shows "Unavailable" in the popup.
	const ERROR_VALUE = {
		"datetime": 0,
		"value": null,
		"datetime-previous": null,
		"value-previous": null,
		"units": null,
	};

	function getResult(data) {
		let result = ERROR_VALUE;
		result.units = data.units;

		// Remove missing data
		let values = data.values.filter((v) => v[1] !== null);

		if(values.length > 0) {
			// Sort the values by datetime (should already be, but just in case)
			values.sort((a,b) => a.datetime - b.datetime);

			result["datetime"] = values.slice(-1)[0][0];
			result["value"] = values.slice(-1)[0][1];
			result["datetime-previous"] = values.slice(-2)[0][0];
			result["value-previous"] = values.slice(-2)[0][1];
		}
		return result;
	}

	if(pathname === "") {
		return UNDEF_VALUE;
	}

	const res = await fetch(URL_TEMPLATE, {
		headers: {
			"Accept": "application/json;version=2",
		}
	});

	return res.json().then( (data) => {
		return getResult(data);
	}).catch(async (error) => {
		// Try one more time, in case there was some intermittent error
		await sleep(1000);
		const res = await fetch(URL_TEMPLATE, {
			headers: {
				"Accept": "application/json;version=2",
			}
		});
		return res.json().then( (data) => {
			return getResult(data);
		}).catch((error) => ERROR_VALUE);
	});
}

Date.prototype.formatDateWithZone = function (tz, offset = false) {
	let dt = new Date(this);

	// If we are at midnight local time (Pacific or Mountain timezone),
	// then subtract a day so we can display "24:00"
	if( (dt.getHours() === 0 || dt.getHours() === 23) && dt.getMinutes() === 0 && dt.getSeconds() === 0) {
		dt.setDate(dt.getDate() - 1);
	}

	var s = dt.toLocaleString('en-US', {
		hourCycle: "h24",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short",
		timeZone: tz,
	});

	var o = dt.toLocaleString('en-US', {
		hourCycle: "h24",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "shortOffset",
		timeZone: tz,
	});

	var a = s.replace(/ /, '').replaceAll(/[,\/:]/g, ' ').split(/ /);
	console.log(a);
	return `${a[2]}-${a[0]}-${a[1]} ${a[3]}:${a[4]} ${offset ? o[6] : a[6]}`;
}

Date.prototype.formatDate24 = function (tz) {
	let dt = new Date(this);

	// If we are at midnight local time (Pacific or Mountain timezone),
	// then subtract a day so we can display "24:00"
	if( (dt.getHours() === 0 || dt.getHours() === 23) && dt.getMinutes() === 0 && dt.getSeconds() === 0) {
		dt.setDate(dt.getDate() - 1);
	}

	var s = dt.toLocaleString('en-US', {
		hourCycle: "h24",
		day: "numeric",
		month: "short",
		timeZone: tz,
	});

	return s;
}

function getLayout(config) {
	let location = config.location;
	let title_suffix = CHART_BASE_CONFIG.location[location].subtitle;

	return {
		title: 'Current Conditions - ' + title_suffix + `<br><span style="font-size: 80%;">Data ending ${config.datetime.formatDateWithZone(CHART_BASE_CONFIG.location[location].tz)}</span>`,
		dragmode: false,
		scatter:
		{
			mode: 'lines',
		},
		geo: {
			scope: 'usa',
			center: CHART_BASE_CONFIG.location[location].center,
			domain: {
				x: [0, 1],
				y: [0, 1]
			},
			lonaxis: {
				range: [CHART_BASE_CONFIG.location[location].center.lon - CHART_BASE_CONFIG.location[location].range.lon / 2,
						CHART_BASE_CONFIG.location[location].center.lon + CHART_BASE_CONFIG.location[location].range.lon / 2]
			},
			lataxis: {
				range: [CHART_BASE_CONFIG.location[location].center.lat - CHART_BASE_CONFIG.location[location].range.lat / 2,
						CHART_BASE_CONFIG.location[location].center.lat + CHART_BASE_CONFIG.location[location].range.lat / 2]
			},
			projection: {
				rotation: {
					roll: CHART_BASE_CONFIG.location[location].range.rotation,
				},
			},
			//fitbounds: 'locations',
			resolution: 50,
			showrivers: true,
			showlakes: true,
			showland: true,
			showsubunits: true,
            countrywidth: 0.5,
            subunitwidth: 0.5,
			below: 'traces',
		},
		mapbox: {
			center: CHART_BASE_CONFIG.location[location].center,
			domain: {
				x: [0, 1],
				y: [0, 1]
			},
			zoom: CHART_BASE_CONFIG.location[location].zoom,
			below: 'traces',
			mode: 'lines+markers+text',
			style: CHART_BASE_CONFIG.style,
			layers: CHART_BASE_CONFIG.layers,
		},
		margin: {
			r: 0,
			t: 55,
			b: 0,
			l: 0,
			pad: 0
		},
		legend: {
			x: 1,
			xanchor: 'right',
			y: 1,
			bgcolor: '#FFFFFF',
			bordercolor: '#000000',
			borderwidth: 2,
		},
		barmode: 'overlay',
		plot_bgcolor: 'rgba(255,255,255,0)',
		paper_bgcolor: 'rgba(255,255,255,0)',
		showlegend: true,
		annotations: [
			{
				x: 0, y: 0,
				text: "All data preliminary and subject to revision, unless otherwise indicated.",
				align: 'left',
				xanchor: 'left',
				yanchor: 'bottom',
				showarrow: false,
				bgcolor: COLOR.ANNOTATION,
			},
		],

		xaxis: {
			showgrid: false,
			showticklabels: false,
			zeroline: false,
			layer: 'below traces',
			fixedrange: true,
			visible: false,
			range: [0,1],
		},
		yaxis: {
			showgrid: false,
			showticklabels: false,
			zeroline: false,
			layer: 'below traces',
			fixedrange: true,
			visible: false,
			range: [0,1],
		},
	};
}

/*
 In Plotly, the maps are drawn above other plot types.
 This prevents drawing things like teacup charts.
 The workaround for this is to move the maps to an earlier
 location in the DOM.
*/
function applyMapHacks(gd) {
	// Move geo chart below subplots
	let svg = gd.getElementsByClassName('main-svg')[0];
	let geo = svg.getElementsByClassName('geolayer')[0];
	svg.insertBefore(geo, svg.getElementsByClassName('layer-below')[0]);

	// Move mapbox below subplots
	let container = gd.getElementsByClassName('svg-container')[0];
	let gl = container.getElementsByClassName('gl-container')[0];
	container.insertBefore(gl, svg);

	// Disable mapbox panning
	if(gd._fullLayout['mapbox'] !== undefined) {
		gd._fullLayout['mapbox']._subplot.map['dragPan'].disable();
	}

	// This is only needed if the CSS property isn't set (or don't want to use it)
	// // Hide xy layer, so it doesn't interact with mouse
	// let xy = gd.querySelector("div > div > svg:nth-child(2) > g.draglayer.cursor-crosshair > g.xy");
	// if(xy !== null) {
	// 	xy.style.display = 'none';
	// }
}

function drawConnectingLines(gd, data) {
	let newData = [];

	for(let point in data) {
		if(data[point].type === `scatter${CHART_BASE_CONFIG.map}`) {
			if(data[point].meta === undefined) {
				break;
			}
			for(let idx = 0; idx < data[point].meta.length; idx ++) {
				// Each scattermapbox point is a GPS marker, which we want to draw a line to the appropriate plot
				// Get the draw position in 'paper' position (0-1)
				let chart_xy = [data[point].meta[idx].x, data[point].meta[idx].y];
				// Project the draw location to the default axis, to get the pixel location
				chart_xy = [gd._fullLayout.xaxis.l2p(chart_xy[0]), gd._fullLayout.yaxis.l2p(chart_xy[1])];
				// Reproject the pixel coordinates onto the map, to get the lat/lon
				let latlon = null;
				if(CHART_BASE_CONFIG.map === 'geo') {
					chart_xy[1] = chart_xy[1] + GEO_MAP_OFFSET;
					latlon = {
						lat: gd._fullLayout['geo']._subplot.projection.invert(chart_xy)[1],
						lng: gd._fullLayout['geo']._subplot.projection.invert(chart_xy)[0]
					}
				} else {
					latlon = gd._fullLayout['mapbox']._subplot.map.unproject(chart_xy);
				}

				newData.push({
					type: `scatter${CHART_BASE_CONFIG.map}`,
					lat: [latlon.lat, parseFloat(data[point].lat[idx])],
					lon: [latlon.lng, parseFloat(data[point].lon[idx])],
					mode: 'lines',
					hoverinfo: 'none',
					showlegend: false,
					legendgroup: data[point].name,
					marker:
					{
						color: COLOR.MARKER_LINE,
						size: '2',
					}
				});
			}
		}
	}
	// Add the traces to the beginning of the data array, so they are under the project markers.
	Plotly.addTraces(gd, newData, range(newData.length));
}

async function buildPlotlyMap(plot_id) {
	let location = document.getElementById('location').value;
	let date = document.getElementById('date').valueAsDate;
	let aspect = ASPECT_RATIO_PORTRAIT;

	//let url_query = `?location=${location}&date=${date.formatDateWithZone('UTC').split(' ')[0]}`
	let url_query = `?location=${location}`
	window.history.replaceState(null, null, window.location.pathname + url_query);

	// Set CSS classes (for orientation)
	document.getElementById(plot_id).classList.value = location;
	if(CHART_BASE_CONFIG.location[location].landscape) {
		document.getElementsByTagName('html')[0].classList.value = "landscape";
		aspect = ASPECT_RATIO_LANDSCAPE;
	} else {
		document.getElementsByTagName('html')[0].classList.value = "";
	}

	addedLines = false;

	const legend_markers = [
		{
			type: 'bar',
			x: [0],
			y: [0],
			name: "Pool Capacity",
			marker: {
				color: COLOR.POOL,
			},
			legendgroup: 'capacity',
			hoverinfo: 'none',
		},
		{
			type: 'bar',
			x: [0],
			y: [0],
			name: "Storage (ac-ft)",
			marker: {
				color: COLOR.STORAGE,
			},
			legendgroup: 'storage',
			hoverinfo: 'none',
		},
		{
			type: 'scatter',
			mode: 'lines',
			x: [0],
			y: [0],
			legendgroup: 'toc',
			name: "Top of Conservation",
			line: {
				color: COLOR.TOC,
			},
			hoverinfo: 'none',
		}
	];

	toggleLoading(plot_id, true);

	d3.csv(`/extra/${location}_reservoirs.csv`, async function(err, rows) {
		try {
			var ownerArray = unpack(rows, 'Owner');
			var owners = [...new Set(ownerArray)];
		
			function unpack(rows, key) {
			return rows.map(function(row) { return row[key]; });
			}
		
			var data = owners.map(function(owners) {
				var rowsFiltered = rows.filter(function(row) {
					return (row.Owner === owners);
				});
				
				// The meta data must be an array itself, not sub-elements, to be referenced in hovertext
				function buildMeta(rowsFiltered) {
					let meta = [];

					for(let row in rowsFiltered) {
						meta.push({
							dam: rowsFiltered[row]['Dam Name'] !== undefined && rowsFiltered[row]['Dam Name'] !== '' ? `&nbsp;&#8211;&nbsp;${rowsFiltered[row]['Dam Name']}` : "",
							elev: rowsFiltered[row]['CWMS-Elevation'],
							stor: rowsFiltered[row]['CWMS-Storage'],
							toc: rowsFiltered[row]['CWMS-TOC'],
							gross_elev: rowsFiltered[row]['Gross Pool Elevation'],
							gross_stor: rowsFiltered[row]['Gross Pool Storage'],
							x: rowsFiltered[row]['X'],
							y: rowsFiltered[row]['Y'],
						});
					}
					return meta;
				}
				console.log(rowsFiltered);
				return {
					type: `scatter${CHART_BASE_CONFIG.map}`,
					name: owners,
					text: unpack(rowsFiltered, 'Name'), 
					lat: unpack(rowsFiltered, 'Latitude'),
					lon: unpack(rowsFiltered, 'Longitude'),
					hoverinfo: "text",
					legendgroup: owners,
					marker: {
						color: unpack(rowsFiltered, 'Owner')[0] === "COE" ? COLOR.MARKER_COE : COLOR.MARKER_SC7,
						size: 10,
					},
					customdata: [],  // Will be filled in later
					meta: buildMeta(rowsFiltered),
					hovertemplate: CHART_BASE_CONFIG.map_hovertemplate,
				};
			});

			var subplot_stor = [];
			var subplot_toc = [];
			var subplot_gross = [];
			var missing_data = false;
			var datetime = null;

			for(let x = 0; x < rows.length; x++) {
				let owner = rows[x]['Owner'];
				let map_points = data[0];
				for(let o = 0; o < data.length; o++) {
					if(data[o].name === owner) {
						map_points = data[o];
						break;
					}
				}

				let stor = getTimeseriesCDA(rows[x]['CWMS-Storage'], date, CHART_BASE_CONFIG.location[location].tz);
				let elev = getTimeseriesCDA(rows[x]['CWMS-Elevation'], date, CHART_BASE_CONFIG.location[location].tz);
				let toc = getTimeseriesCDA(rows[x]['CWMS-TOC'], date, CHART_BASE_CONFIG.location[location].tz);

				let stor_missing = false;
				let toc_missing = false;
				let elev_missing = false;

				if( (await stor.then( (v) => v.value )) === null ) {
					missing_data = true;
					stor_missing = true;
				}

				if( await toc.then( (v) => v.value ) === null || await toc.then( (v) => v.value ) === undefined 
					|| await toc.then( (v) => v.datetime ) != await stor.then( (v) => v.datetime )) {          // make sure TOC date matches storage
					toc_missing = true;
				}

				if( (await elev.then( (v) => v.value )) === null ) {
					elev_missing = true;
				}

				if(datetime === null || datetime < await stor.then( (v) => v.datetime)) {
					datetime = new Date();
					datetime.setTime(await stor.then( (v) => v.datetime ));
				}
				subplot_gross.push({
					type: 'bar',
					x: [0],
					// x: [await stor.then( (v) => new Date(v.datetime) )],
					y: [parseFloat(rows[x]['Gross Pool Storage'])],
					width: 0.9,
					name: rows[x]['Name'],
					marker: {
						color: COLOR.POOL,
					},
					meta: {
						name: 'Gross Pool Storage',
						unit: await stor.then( (v) => v.units ),
						datetime: await stor.then( (v) => new Date(v.datetime) ),
					},
					showlegend: false,
					legendgroup: 'capacity',
					hoverinfo: 'text',
					hovertemplate: '%{y} %{meta.unit}<extra>%{meta.name}</extra>',
				
					xaxis: `x${x+2}`,
					yaxis: `y${x+2}`,
				});

				let stor_data = {
					type: 'bar',
					x: [0],
					// x: [await stor.then( (v) => new Date(v.datetime) )],
					y: [stor_missing ? parseFloat(rows[x]['Gross Pool Storage']) : await stor.then( (v) => v.value )],
					name: rows[x]['Name'],
					marker: {
						color: stor_missing ? COLOR.MISSING : COLOR.STORAGE,
					},
					meta: {
						name: 'Current Storage',
						gross_stor: parseFloat(rows[x]['Gross Pool Storage']),
						toc: !toc_missing ? await toc.then( (v) => v.value ) : null,
						unit: await stor.then( (v) => v.units ),
						x: parseFloat(rows[x]['X']),
						y: parseFloat(rows[x]['Y']),
						datetime: await stor.then( (v) => new Date(v.datetime) ),
					},
					showlegend: false,
					legendgroup: stor_missing ? 'missing' : 'storage',
					//hoverinfo: stor_missing ? 'text' : 'y',
					hoverinfo: 'text',
					hovertemplate: stor_missing ? 'Storage data unavailable<extra>%{meta.name}</extra>' : '%{y} %{meta.unit}<extra>%{meta.name}</extra>',

					xaxis: `x${x+2}`,
					yaxis: `y${x+2}`,
				};

				subplot_stor.push(stor_data);

				let toc_data = {
					type: 'scatter',
					mode: 'lines',
					xref: `x${x+2}`,
					yref: `y${x+2}`,
					// TOC has 3 points, so the center value can be used to aid hover popup
					x: [subplot_stor[x].x[0] - 0.5, subplot_stor[x].x[0], subplot_stor[x].x[0] + 0.5],
					//x: [await toc.then( (v) => new Date(v.datetime - 0.5) ), await toc.then( (v) => new Date(v.datetime) ), await toc.then( (v) => new Date(v.datetime + 0.5) )],
					y: [subplot_stor[x].meta.toc, subplot_stor[x].meta.toc, subplot_stor[x].meta.toc],
					line: {
						color: COLOR.TOC,
						width: 2,
					},
					legendgroup: 'toc',
					name: rows[x]['Name'],
					meta: {
						name: 'Top of Conservation',
						unit: await toc.then( (v) => v.units ),
						datetime: await stor.then( (v) => new Date(v.datetime) ),
					},
					showlegend: false,
					hoverinfo: 'text',
					hovertemplate: '%{y} %{meta.unit}<extra>%{meta.name}</extra>',

					xaxis: `x${x+2}`,
					yaxis: `y${x+2}`,
				};
				subplot_toc.push(toc_data);

				map_points.customdata.push(
					{
						toc: toc_data.y[0] === undefined ? CHART_BASE_CONFIG.na_text : toc_data.y[0] === null ? CHART_BASE_CONFIG.unavailable_text : STOR_NFORMAT.format(toc_data.y[0]),
						toc_units: !toc_missing ? toc_data.meta.unit : '',

						stor: !stor_missing ? STOR_NFORMAT.format(stor_data.y[0]) : CHART_BASE_CONFIG.unavailable_text,
						stor_units: !stor_missing && stor_data.meta.unit != null ? stor_data.meta.unit : '',
						gross_stor_units: stor_data.meta.unit != null ? stor_data.meta.unit : '',

						// Elevation data isn't placed on the subplots, it's only in the hover popup.
						// SPK doesn't use elevation data directly. Other districts may want to change this design.
						elev: !elev_missing ? NFORMAT.format(await elev.then( (v) => v.value )) : CHART_BASE_CONFIG.unavailable_text,
						elev_units: !elev_missing ? await elev.then( (v) => v.units ) : '',
						gross_elev_units: await elev.then( (v) => v.units ) != null ? await elev.then( (v) => v.units ) : '',

						// Other parameters
						fill: !stor_missing ? PFORMAT.format(stor_data.y[0] / stor_data.meta.gross_stor) : CHART_BASE_CONFIG.unavailable_text,
					}
				);
			};

			if(missing_data) {
				legend_markers.push({
					type: 'bar',
					x: [0],
					y: [0],
					name: "No Data",
					marker: {
						color: COLOR.MISSING,
					},
					legendgroup: 'missing',
					hoverinfo: 'none',
				});
			}
			data = [...data, ...subplot_gross, ...subplot_stor, ...subplot_toc, ...legend_markers];

			console.log(data);

			var config = {
				responsive: true,
				scrollZoom: false,
				displayModeBar: false,
				showTips: false,
			};

			let layout = getLayout({datetime: datetime, location: location});

			// Add axis for subplots
			for(let x = 0; x < subplot_stor.length; x++) {
				layout[`yaxis${x+2}`] = {
					domain: [subplot_stor[x].meta["y"] - SUBPLOT_HEIGHT / aspect.h, subplot_stor[x].meta["y"]],
					//domain: [subplot_stor[x].meta["y"], subplot_stor[x].meta["y"] + SUBPLOT_HEIGHT / aspect.h],
					fixedrange: true,
					range: [0 - subplot_stor[x].meta['gross_stor'] * 0.01, subplot_stor[x].meta['gross_stor'] * 1.01],	// Add 1% to the max height, so the top isn't cut off
					gridcolor: "rgba(0,0,0,1)",
					anchor: `x${x+2}`,
					hoverformat: '.5~s',
				};
				layout[`xaxis${x+2}`] = {
					domain: [subplot_stor[x].meta['x'], subplot_stor[x].meta['x'] + SUBPLOT_WIDTH / aspect.w],
					fixedrange: true,
					rangemode: 'tozero',
					showgrid: false,
					showticklabels: true,
					tickmode: 'array',
					tickvals: [0],
					ticktext: [subplot_stor[x].meta['datetime'].formatDate24(CHART_BASE_CONFIG.location[location].tz)],
					anchor: `y${x+2}`,
				};
			}

			// Add a background to the subplots
			layout['shapes'] = [];

			for(let x = 0; x < subplot_stor.length; x++) {
				// Background
				layout.shapes.push({
					type: 'rect',
					// The subplot background is sized relative to the plot itself
					x0: -0.675,                // Left margin from plot area (y-axis tick labels)
					y0: -0.25,                 // Bottom margin from plot area
					x1: 1.125,                 // Right margin from plot area
					y1: 1.275,                 // Top margin from plot area (subplot title)
					label: {
						text: subplot_stor[x].name,
						textposition: 'top center',
						padding: 1,
					},
					xref: `x${x+2} domain`,
					yref: `y${x+2} domain`,
					line: {
						width: 1,
					},
					fillcolor: 'rgba(255,255,255,1)',
					layer: 'below',
				});
			}

			console.log(layout);
			Plotly.newPlot(plot_id, data, layout, config);

			document.getElementById(plot_id).on('plotly_afterplot', function(){
				let gd = document.getElementById(plot_id);

				applyMapHacks(gd);

				if(!addedLines) {
					addedLines = true;
					drawConnectingLines(gd, data);
				}

				toggleLoading(plot_id, false);
			});
		}
		catch (e){
			toggleLoading(plot_id, false);
			throw e;
		}
	});
}

function setMapStyle(elem, plot_id) {
	let parts = elem.value.split('_');
	CHART_BASE_CONFIG.map = parts[0];
	CHART_BASE_CONFIG.layers = null;
	console.log(parts);

	if(CHART_BASE_CONFIG.map === "mapbox") {
		if(parts[1] === "layer") {
			CHART_BASE_CONFIG.style = "white-bg";
			CHART_BASE_CONFIG.layers = [
				{
					sourcetype: "raster",
					source: [`https://basemap.nationalmap.gov/arcgis/rest/services/${parts[2]}/MapServer/tile/{z}/{y}/{x}`],
					below: "traces"
				},
			]
		}
		else if(parts[1] === "arcgis") {
			let base = parts[2]; //.replaceAll(/_/g, '-');
			CHART_BASE_CONFIG.style = `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/${base}?token=${GIS_API_KEY}`;
			// CHART_BASE_CONFIG.layers = [
			// 	{
			// 		sourcetype: "raster",
			// 		source: [`https://server.arcgisonline.com/arcgis/rest/services/${base}/MapServer/tile/{z}/{y}/{x}`,
			// 				 `https://services.arcgisonline.com/arcgis/rest/services/${base}/MapServer/tile/{z}/{y}/{x}`,
			// 		],
			// 		below: "traces"
			// 	},
			// ]
		}
		else if(parts[1] === "osm") {
			CHART_BASE_CONFIG.style = "white-bg";
			CHART_BASE_CONFIG.layers = [
				{
					// Need API key
					sourcetype: "raster",
					source: MAPS[parts[2]].sources,
					below: "traces"
				},
			]
		}
		else {
			CHART_BASE_CONFIG.style = parts[1];
		}
	}

	buildPlotlyMap(plot_id);
}

// This code is specific to this page, custom usage will require changing this.
window.addEventListener("load", () => {
	let date = document.getElementById('date');
	let dt = new Date();

	date.max = dt.formatDateWithZone(Intl.DateTimeFormat().resolvedOptions().timeZone).split(" ")[0];
	date.valueAsDate = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
	let location = document.getElementById('location');

	console.log("Starting info: " + window.location.search);
	query = window.location.search.substring(1);

	if (query !== null && query !== "") {
		try {
			console.log(query);
			params = query.split("&");
			console.log(params);
			for (var i = 0; i < params.length; i++) {
				p = params[i];
				kv = p.split("=");
				k = kv[0];
				v = kv[1];
				if (k.toLowerCase() == "location") {
					location.value = v;
				} else if (k.toLowerCase() == "date") {
					date.valueAsDate = new Date(Date.parse(v));
				}
			}
		} catch (e) {
			console.log("Could not load plot based on provided query parameters");
			console.log(e)
		}
	}

	buildPlotlyMap(PLOT_ID);
});
