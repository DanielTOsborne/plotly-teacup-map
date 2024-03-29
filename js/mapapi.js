const DISTRICT = 'SPK';
const CDA_BASE = 'https://cwms-data.usace.army.mil/cwms-data';
// How many results to return per CDA query. The proper value depends on the interval of the time series. 10 is good for a week of daily data.
const CDA_PAGE_SIZE = 20;
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

const ASPECT_RATIO_PORTRAIT = {w: 1, h: 1.348684};	// Aspect ratio for map (so it prints on 8.5x11 paper)
const ASPECT_RATIO_LANDSCAPE = {w: 1.348684, h: 1}; // This should match the aspect ratio of the width and height defined in the CSS.

// The geo map offsets the Y values, why?
const GEO_MAP_OFFSET = 50;

// The column header labels for the data file. Can be changed if desired.
const CSV_HEADERS = {
	LAKE_NAME: 'Name',
	DAM_NAME: 'Dam Name',
	OWNER: 'Owner',
	GPS_LATITUDE: 'Latitude',
	GPS_LONGITUDE: 'Longitude',
	GPS_ELEVATION: 'Elevation',
	GROSS_POOL_STORAGE: 'Gross Pool Storage',
	GROSS_POOL_ELEVATION: 'Gross Pool Elevation',
	CWMS_STORAGE: 'CWMS-Storage',
	CWMS_ELEVATION: 'CWMS-Elevation',
	CWMS_TCS: 'CWMS-TOC',
	SUBPLOT_LOCATION_X: 'X',
	SUBPLOT_LOCATION_Y: 'Y',
}

// Choose colors at https://www.w3schools.com/colors/colors_picker.asp
// To use the plotly default, just set the value to null: e.g. `ANNOTATION_BG: null,`
const COLOR = {
	MARKER_COE: 'rgb(255,77,77)',
	MARKER_SC7: 'rgb(77,148,255)',
	MARKER_LINE: 'rgb(0,0,0)',
	TOC: 'rgb(255,0,0)',
	POOL: 'rgb(255,204,102)',
	STORAGE: 'rgb(0,64,255)',
	MISSING: 'rgb(148,77,255)',
	ANNOTATION_BG: 'rgba(255,255,255,0.66)',
}

const CHART_LABELS = {
	LEGEND: {
		NO_DATA: 'No Data',
		GROSS_POOL: 'Pool Capacity',
		STORAGE: 'Storage (ac-ft)',
		TOC_STORAGE: 'Top of Conservation',
	},
	STORAGE: 'Current Storage',
	ELEVATION: 'Current Elevation',
	GROSS_POOL_STORAGE: 'Gross Pool Storage',
	GROSS_POOL_ELEVATION: 'Gross Pool Elevation',
	TOC_STORAGE: 'Top of Conservation',
	CAPACITY_FILLED: 'Capacity Filled',
	ENCROACHMENT: 'Encroachment',
}

var CHART_BASE_CONFIG = 
{
	map: 'mapbox',                             // Can use 'geo' or 'mapbox'
	style: 'open-street-map',
	layers: null,
	location: {
		ca: {                                  // This key should be the first part of the filename (e.g. ca_reservoirs.csv)
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
		cv: {                                  // This key should be the first part of the filename (e.g. ca_reservoirs.csv)
			subtitle: 'California Central Valley', // Subtitle, appears as suffix on the plot title
			center: {
				lat: 38.265,
				lon: -121.036
			},
			zoom: 5.6,                         // For mapbox, map zoom level
			range: {
				lon: 9.0,                      // For geo map, longitude width of view
				lat: 10.6,                     // For geo map, latitude height of view
			},
			tz: 'America/Los_Angeles',
		},
		tg: {                                  // This key should be the first part of the filename (e.g. ca_reservoirs.csv)
			subtitle: 'Truckee Storage Group', // Subtitle, appears as suffix on the plot title
			center: {
				lat: 39.396,
				lon: -120.120
			},
			zoom: 9.3,                         // For mapbox, map zoom level
			range: {
				lon: 0.87,                     // For geo map, longitude width of view
				lat: 1.0,                      // For geo map, latitude height of view
			},
			tz: 'America/Los_Angeles',
		},
		nc: {                                  // This key should be the first part of the filename (e.g. ca_reservoirs.csv)
			subtitle: 'California North Coast',// Subtitle, appears as suffix on the plot title
			center: {
				lat: 38.507,
				lon: -122.383
			},
			zoom: 7,                           // For mapbox, map zoom level
			range: {
				lon: 4.0,                      // For geo map, longitude width of view
				lat: 4.75,                     // For geo map, latitude height of view
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
	<em>${CHART_LABELS.GROSS_POOL_STORAGE}:</em> %{customdata.gross_stor:,.0f} %{customdata.gross_stor_units}<br>
	<em>${CHART_LABELS.STORAGE}:</em> %{customdata.stor} %{customdata.stor_units}<br>
	<em>${CHART_LABELS.TOC_STORAGE}:</em> %{customdata.toc} %{customdata.toc_units}<br>
	<br>
	<em>${CHART_LABELS.GROSS_POOL_ELEVATION}:</em> %{customdata.gross_elev:,.2f} %{customdata.gross_elev_units}<br>
	<em>${CHART_LABELS.ELEVATION}:</em> %{customdata.elev} %{customdata.elev_units}<br>
	<br>
	<em>${CHART_LABELS.CAPACITY_FILLED}:</em> %{customdata.fill}<br>
	<em>${CHART_LABELS.ENCROACHMENT}:</em> %{customdata.encroachment}<br>`
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

async function getTimeseriesCDA(pathname, date, tz) {
	let begin = new Date(date);
	begin.setDate(begin.getDate() - 7);

	const URL_TEMPLATE = `${CDA_BASE}/timeseries?name=${encodeURIComponent(pathname)}&begin=${encodeURIComponent(begin.toISOString().split('Z')[0])}&end=${encodeURIComponent(date.toISOString().split('Z')[0])}&office=${DISTRICT}&timezone=${encodeURIComponent(tz)}&page-size=${CDA_PAGE_SIZE}`

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

async function getLevelCDA(pathname, date, tz, units) {
	const URL_TEMPLATE = `${CDA_BASE}/levels/${encodeURIComponent(pathname)}?effective-date=${encodeURIComponent(date.toISOString().split('Z')[0])}&unit=${units}&office=${DISTRICT}&timezone=${encodeURIComponent(tz)}`

	// Undefined means the TS path wasn't set in the CSV, this shows "N/A" in the popup.
	const UNDEF_VALUE = {
		"datetime": 0,
		"value": undefined,
		"units": null,
	};

	// Normal error condition, shows "Unavailable" in the popup.
	const ERROR_VALUE = {
		"datetime": 0,
		"value": null,
		"units": null,
	};

	function getResult(data) {
		let result = ERROR_VALUE;
		result.units = data["level-units-id"];

		result.datetime = new Date(data["level-date"]);
		result.value = data["constant-value"];

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

async function getLevel(value_or_name, date, tz, units) {
	let value = value_or_name;
	let value_result = null;

	// Values might be stored as a literal in the CSV, or a CWMS location level
	// If value is not a number, then assume it's a Location Level
	if(isNaN(value)) {
		let value = getLevelCDA(value_or_name, date, tz, units);
		value_result = await value.then( (v) => v );
	} else {
		value_result = {
			"datetime": date,
			"value": parseFloat(value),
			"units": units,
		}
	}

	return value_result;
}

Date.prototype.formatDateWithZone = function (tz, offset = false) {
	let dt = new Date(this);

	// If we are at midnight local time (Pacific or Mountain timezone),
	// then subtract a day so we can display "24:00"
	// TODO: This uses the local browser timezone, so might be wrong sometimes. Fix this, if possible.
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
	// TODO: This uses the local browser timezone, so might be wrong sometimes. Fix this, if possible.
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

function computeEncroachment(gross, toc, storage) {
	if(gross === null || toc === null || storage === null) {
		return null;
	}
	if(toc === undefined) {
		return undefined;
	}

	let encr = 0;

	// Storage can be higher than gross if there's a sensor or rounding error.
	// Compute encroachment, but capping at 100%, so we don't get insanely inflated values as the flood pool shrinks to 0.
	if(storage > toc && gross > toc && storage <= gross) {
		encr = Math.min((storage - toc) / Math.max(gross - toc, 1), 1);
	} else if(storage > gross) {
		encr = 1;
	}

	return encr;
}

function getLayout(config) {
	let location = config.location;
	let title_suffix = CHART_BASE_CONFIG.location[location].subtitle;

	return {
		title: `Current Conditions - ${title_suffix}<br><span style="font-size: 80%;">Data ending ${config.datetime.formatDateWithZone(CHART_BASE_CONFIG.location[location].tz)}</span>`,
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
				bgcolor: COLOR.ANNOTATION_BG,
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

	// Swap this line with the next one, if you want to have a specific date in the URL for bookmarking.
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
			name: CHART_LABELS.LEGEND.GROSS_POOL,
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
			name: CHART_LABELS.LEGEND.STORAGE,
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
			name: CHART_LABELS.LEGEND.TOC_STORAGE,
			line: {
				color: COLOR.TOC,
			},
			hoverinfo: 'none',
		}
	];

	toggleLoading(plot_id, true);

	d3.csv(`/extra/${location}_reservoirs.csv`, async function(err, rows) {
		try {
			var ownerArray = unpack(rows, CSV_HEADERS.OWNER);
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
							dam: rowsFiltered[row][CSV_HEADERS.DAM_NAME] !== undefined && rowsFiltered[row][CSV_HEADERS.DAM_NAME] !== '' ? `&nbsp;&#8211;&nbsp;${rowsFiltered[row][CSV_HEADERS.DAM_NAME]}` : "",
							elev: rowsFiltered[row][CSV_HEADERS.CWMS_ELEVATION],
							stor: rowsFiltered[row][CSV_HEADERS.CWMS_STORAGE],
							toc: rowsFiltered[row][CSV_HEADERS.CWMS_TCS],
							gross_elev: rowsFiltered[row][CSV_HEADERS.GROSS_POOL_ELEVATION],
							gross_stor: rowsFiltered[row][CSV_HEADERS.GROSS_POOL_STORAGE],
							x: rowsFiltered[row][CSV_HEADERS.SUBPLOT_LOCATION_X],
							y: rowsFiltered[row][CSV_HEADERS.SUBPLOT_LOCATION_Y],
						});
					}
					return meta;
				}
				console.log(rowsFiltered);
				return {
					type: `scatter${CHART_BASE_CONFIG.map}`,
					name: owners,
					text: unpack(rowsFiltered, CSV_HEADERS.LAKE_NAME), 
					lat: unpack(rowsFiltered, CSV_HEADERS.GPS_LATITUDE),
					lon: unpack(rowsFiltered, CSV_HEADERS.GPS_LONGITUDE),
					hoverinfo: "text",
					legendgroup: owners,
					marker: {
						color: unpack(rowsFiltered, CSV_HEADERS.OWNER)[0] === "COE" ? COLOR.MARKER_COE : COLOR.MARKER_SC7,
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
				let owner = rows[x][CSV_HEADERS.OWNER];
				let map_points = data[0];
				for(let o = 0; o < data.length; o++) {
					if(data[o].name === owner) {
						map_points = data[o];
						break;
					}
				}

				let stor = getTimeseriesCDA(rows[x][CSV_HEADERS.CWMS_STORAGE], date, CHART_BASE_CONFIG.location[location].tz);
				let elev = getTimeseriesCDA(rows[x][CSV_HEADERS.CWMS_ELEVATION], date, CHART_BASE_CONFIG.location[location].tz);
				let toc = getTimeseriesCDA(rows[x][CSV_HEADERS.CWMS_TCS], date, CHART_BASE_CONFIG.location[location].tz);

				// The units are hardcoded here to speed up the queries. This will be validated below.
				// Waiting for getTimeseriesCDA results before fetching locations with the units increases loading time by about 50%.
				let gross_stor = getLevel(rows[x][CSV_HEADERS.GROSS_POOL_STORAGE], date, CHART_BASE_CONFIG.location[location].tz, "ac-ft");
				let gross_elev = getLevel(rows[x][CSV_HEADERS.GROSS_POOL_ELEVATION], date, CHART_BASE_CONFIG.location[location].tz, "ft");

				let stor_missing = false;
				let toc_missing = false;
				let elev_missing = false;

				let toc_result = await toc.then( (v) => v );
				let stor_result = await stor.then( (v) => v );
				let elev_result = await elev.then( (v) => v );

				if( stor_result.value === null ) {
					missing_data = true;
					stor_missing = true;
				}

				let gross_stor_result = await gross_stor.then( (v) => v );
				let gross_elev_result = await gross_elev.then( (v) => v );

				// Check if the units match, and refetch if not
				if(gross_elev_result.units != elev_result.units) {
					gross_elev = getLevel(rows[x][CSV_HEADERS.GROSS_POOL_ELEVATION], date, CHART_BASE_CONFIG.location[location].tz, elev_result.units);
					gross_elev_result = await gross_elev.then( (v) => v );
				}
				if(gross_stor_result.units != stor_result.units) {
					gross_stor = getLevel(rows[x][CSV_HEADERS.GROSS_POOL_STORAGE], date, CHART_BASE_CONFIG.location[location].tz, stor_result.units);
					gross_stor_result = await gross_elev.then( (v) => v );
				}

				let diff = stor_result.datetime - toc_result.datetime;
				console.debug(`${rows[x][CSV_HEADERS.LAKE_NAME]} diff: ${diff}`);

				// If it's null, there is supposed to be a TOC, but it hasn't computed for the requested date. Shows "Unavailable" on popup.
				// If the value is undefined, there is no TOC for this reservoir (e.g. Farmington). Shows "N/A" on popup.
				if( toc_result.value === null || toc_result.value === undefined 
					// TOC should be within a day of the storage value to be valid. If all data is daily interval, they will be the exact same time.
					// For some irregular TS cases (i.e. Folsom), TOC is computed multiple times a day. Allow time mismatch if it's within a day.
					|| diff < 0 || diff >= 86400000) {
					toc_missing = true;

					if(toc_result.value !== undefined) {
						toc_result.value = null;
					}
				}

				if( elev_result.value === null ) {
					elev_missing = true;
				}

				if(datetime === null || datetime < stor_result.datetime) {
					datetime = new Date();
					datetime.setTime(stor_result.datetime);
				}
				subplot_gross.push({
					type: 'bar',
					x: [0],
					// x: [new Date(stor_result.datetime)],
					y: [gross_stor_result.value],
					width: 0.9,
					name: rows[x][CSV_HEADERS.LAKE_NAME],
					marker: {
						color: COLOR.POOL,
					},
					meta: {
						name: CHART_LABELS.GROSS_POOL_STORAGE,
						unit: stor_result.units,
						datetime: new Date(stor_result.datetime ),
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
					// x: [new Date(stor_result.datetime)],
					y: [stor_missing ? gross_stor_result.value : stor_result.value],
					name: rows[x][CSV_HEADERS.LAKE_NAME],
					marker: {
						color: stor_missing ? COLOR.MISSING : COLOR.STORAGE,
					},
					meta: {
						name: CHART_LABELS.STORAGE,
						gross_stor: gross_stor_result.value,
						toc: toc_result.value,
						unit: toc_result.units,
						x: parseFloat(rows[x][CSV_HEADERS.SUBPLOT_LOCATION_X]),
						y: parseFloat(rows[x][CSV_HEADERS.SUBPLOT_LOCATION_Y]),
						datetime: new Date(stor_result.datetime),
					},
					showlegend: false,
					legendgroup: stor_missing ? 'missing' : 'storage',
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
					//x: [new Date(toc_result.datetime - 0.5), new Date(toc_result.datetime), new Date(toc_result.datetime + 0.5)],
					y: [subplot_stor[x].meta.toc, subplot_stor[x].meta.toc, subplot_stor[x].meta.toc],
					line: {
						color: COLOR.TOC,
						width: 2,
					},
					legendgroup: 'toc',
					name: rows[x][CSV_HEADERS.LAKE_NAME],
					meta: {
						name: CHART_LABELS.TOC_STORAGE,
						unit: toc_result.units,
						datetime: new Date(stor_result.datetime),  // Use storage date, so the bars are always aligned
					},
					showlegend: false,
					hoverinfo: 'text',
					hovertemplate: '%{y} %{meta.unit}<extra>%{meta.name}</extra>',

					xaxis: `x${x+2}`,
					yaxis: `y${x+2}`,
				};
				subplot_toc.push(toc_data);

				let encr = computeEncroachment(stor_data.meta.gross_stor, toc_data.y[0], stor_data.y[0]);

				map_points.customdata.push(
					{
						toc: toc_data.y[0] === undefined ? CHART_BASE_CONFIG.na_text : toc_data.y[0] === null ? CHART_BASE_CONFIG.unavailable_text : STOR_NFORMAT.format(toc_data.y[0]),
						toc_units: !toc_missing ? toc_data.meta.unit : '',

						stor: !stor_missing ? STOR_NFORMAT.format(stor_data.y[0]) : CHART_BASE_CONFIG.unavailable_text,
						stor_units: !stor_missing && stor_data.meta.unit != null ? stor_data.meta.unit : '',
						gross_stor: stor_data.meta.gross_stor,
						gross_stor_units: stor_data.meta.unit != null ? stor_data.meta.unit : '',

						// Elevation data isn't placed on the subplots, it's only in the hover popup.
						// SPK doesn't use elevation data directly. Other districts may want to change this design.
						elev: !elev_missing ? NFORMAT.format(elev_result.value) : CHART_BASE_CONFIG.unavailable_text,
						elev_units: !elev_missing ? elev_result.units : '',
						gross_elev: gross_elev_result.value,
						gross_elev_units: elev_result.units != null ? elev_result.units : '',

						//// Other parameters
						// Filled Capacity
						fill: !stor_missing ? PFORMAT.format(stor_data.y[0] / stor_data.meta.gross_stor) : CHART_BASE_CONFIG.unavailable_text,
						// Encroachment
						encroachment: encr === undefined ? CHART_BASE_CONFIG.na_text : encr === null ? CHART_BASE_CONFIG.unavailable_text : PFORMAT.format(encr)
					}
				);
			};

			if(missing_data) {
				legend_markers.push({
					type: 'bar',
					x: [0],
					y: [0],
					name: CHART_LABELS.LEGEND.NO_DATA,
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
					y1: 1.3,                   // Top margin from plot area (subplot title)
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

	// date.onchange = function(evt) {
	// 	buildPlotlyMap(PLOT_ID);
	// }
	buildPlotlyMap(PLOT_ID);
});
