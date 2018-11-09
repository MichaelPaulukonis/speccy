// Experiments in automatically converting images into a image resembling a zx specrum screen

var speccy_palette = [
    [0, 0, 0],      // black
    [215, 0, 0],    // dark red
    [0, 215, 0],    // dark green
    [215, 215, 0],  // dark yellow
    [0, 0, 215],    // dark blue
    [215, 0, 215],  // dark magenta
    [0, 215, 215],  // dark cyan
    [0, 0, 0],      // black
    [215, 215, 215], // grey
    [255, 0, 0],     // red
    [0, 255, 0],     // green
    [255, 255, 0],   // yellow
    [0, 0, 255],     // blue
    [255, 0, 255],   // magenta
    [0, 255, 255],   // cyan
    [255, 255, 255]  // white
];

// subtract two arrays
function sub(a, b) {
	return a.map((x, i) => x - b[i]);
}

// dot product two arrays
function dot(a,b) {
	let n = 0, lim = Math.min(a.length,b.length);
	for (var i = 0; i < lim; i++) n += a[i] * b[i];
	return n;
}

// sqrt distance between two arrays
function vdist(a, b) {

	let delta = sub(a, b);
	return dot(delta, delta);
}

// select closest color from an array of colors
function rgb2speccy(r, g, b, palette, start, end) {
	let best_color = start;
	let best_distance_sqrt = vdist(palette[start], [r, g, b]);

	for (var i = start+1; i < end; i++) {
		let d = vdist(palette[i], [r, g, b]);
		if (d < best_distance_sqrt) {
			best_distance_sqrt = d;
			best_color = i;
		}
	}

	return best_color;
}

const rgb2light = (r, g, b) => rgb2speccy(r, g, b, speccy_palette, 0, 9);
const rgb2dark  = (r, g, b) => rgb2speccy(r, g, b, speccy_palette, 9, speccy_palette.length);

// 0.0 - 1.0 rgb
function rgb2hsl(r, g, b)
{
	const min = Math.min(r, g, b);
	const max = Math.max(r, g, b);

    const light = (min + max) / 2.0;
    let sat = 0.0;

	if( min == max ) {
		return [-1, light, sat];
	}
	
	const delta = max - min;

	if (light <= 0.5) {
		sat = delta / (max + min);
	}
	else {
		sat = delta / (2.0 - (max + min));
	}

    let hue = 0.0;

    if (r == max) {
        hue = (g - b) / delta;		// between yellow & magenta
    }
    else if (g == max) {
        hue = 2.0 + (b - r) / delta;	// between cyan & yellow
    }
    else {
        hue = 4.0 + (r - g) / delta;	// between magenta & cyan
    }

    hue *= 60.0;				// degrees
    
    if (hue < 0.0) {
        hue += 360.0;
    }

	return [hue, light, sat];
}

function hsl2speccydark(hue, light, sat) {

	if (sat > 0.25 && light > 0.25 && hue >= 0) {
		if (hue > 270) {
			return 5; // magenta
		}
		else if (hue > 210) {
			return 4; // blue
		}
		else if (hue > 150) {
			return 6; // cyan
		}
		else if (hue > 90) {
			return 2;   // green
		}
		else if (hue > 30) {
			return 3; //yellow
		}
		else if (hue >= 0) {
			return 1; // red
		}
	}
	else {
		return 0;
	}
}

function hsl2speccylight(hue, light, sat) {
	if (sat > 0.125 && hue >= 0) {
		if (hue > 270) {
			return 13; // magenta
		}
		else if (hue > 210) {
			return 12; // blue
		}
		else if (hue > 150) {
			return 14; // cyan
		}
		else if (hue > 90) {
			return 10;   // green
		}
		else if (hue > 30) {
			return 11; //yellow
		}
		else if (hue >= 0) {
			return 9; // red
		}
	}
	else {
		// map to a speccy grey
		let i = 8;
		if (light >= 0.84) i = 15;
		
		return i;
	}
}

function rgb2hsl2light(r, g, b) {
	let [hue, light, sat] = rgb2hsl(float(r) / 256.0,
									float(g) / 256.0,
									float(b) / 256.0);
				
	return hsl2speccylight(hue, light, sat);
}

function rgb2hsl2dark(r, g, b) {
	let [hue, light, sat] = rgb2hsl(float(r) / 256.0,
									float(g) / 256.0,
									float(b) / 256.0);
				
	return hsl2speccydark(hue, light, sat);
}

var dither_matrix = [
    [0,  8,  2,  10],
    [12, 4,  14, 6 ],
    [3,  11, 1,  9 ], 
    [15, 7,  13, 5 ]
];

let colorizeCells = true;
let ditherFactor = 16;
let weightedColorDist = true;
let colorSelection = 'rgb';

function dither(pixel, c, r) {
	const i = r % 4;
	const j = c % 4;

	// convert to black and white
	const shade = 0.21 * pixel[0] + 0.72 * pixel[1] + 0.07 * pixel[2];

	return (dither_matrix[i][j] * ditherFactor >= shade) ? 0 : 255;
}

// return block offset for a given pixel
function pix2block(c, r) {
	const x = int(c / 8);
	const y = int(r / 8);
	return y * 32 + x;
}

function createBlockBins() {
	let blocks = new Array(32 * 24);

	for (let i = 0; i < blocks.length; i++) {
		blocks[i] = new Array(16).fill(0);
	}

	return blocks;
}

// convert an image into a zx spectrum image
// via binning
function convertImage(img_in, img_out, lightFunc, darkFunc) {

	let lblocks = lightFunc ? createBlockBins() : null;
	let dblocks = darkFunc ? createBlockBins() : null;

	for (var y = 0; y < img_in.height; y++) {
		for (var x = 0; x < img_in.width; x++) {
			const offset = pix2block(x, y);
			const p = img_in.get(x, y);
			const shade = dither(p, x, y);
			
			if (shade === 0) { // dark pixel
				if (dblocks !== null && darkFunc !== null) {
					let c = darkFunc(p[0], p[1], p[2]);
					dblocks[offset][c]++;
				}
			}
			else { // light pixel;
				if (lblocks !== null && lightFunc !== null) {
					let c = lightFunc(p[0], p[1], p[2]);
					lblocks[offset][c]++;
				}
			}

			img_out.set(x, y, [shade, shade, shade, 255]);
		}
	}

	img_out.updatePixels();

	for (var y = 0; y < img_out.height; y++) {
		for (var x = 0; x < img_out.width; x++) {
			const offset = pix2block(x, y);
			const p = img_out.get(x, y);
			const blocks = (p[0] != 0) ? lblocks : dblocks;
			let i = 0;
			if (blocks !== null) {
				const bins = blocks[offset];
				i = bins.indexOf(Math.max(...bins));
			}
			const [r, g, b] = speccy_palette[i];
			img_out.set(x, y, [r, g, b, 255]);
		}
	}

	img_out.updatePixels();
}

function processImageDither(img_in, img_out) {

    for(var r = 0; r < img_in.height; r++)
	{
		for(var c = 0; c < img_in.width; c++)
		{
			const p = img_in.get(c, r);

			const shade = dither(p, c, r);

			img_out.set(c, r, [shade, shade, shade, 255]);
		}
	}

	img_out.updatePixels();
}

var img_in = null, img_out;
let checkbox;
let canvas;
let fileURL = '';
let backgroundColor = 'CORNFLOWERBLUE';
let slider;
let dirty = false;
let dropdown;

function setup() {
	const scaleFactor = 2;
	canvas = createCanvas(256 * scaleFactor, 192 * scaleFactor);
	canvas.parent('canvas-holder');
    canvas.drop(gotFile);

    img_in = createImage(256, 192);
	img_out = createImage(256, 192);
	
	slider = select("#start");
	checkbox = select('#ditheronly', false);

	dropdown = createSelect(); // or create dropdown?
	dropdown.option('RGB','rgb');
	dropdown.option('RGB Fixed','rgbfixed');
	dropdown.option('HSL', 'hsl');
	dropdown.option('HSL Fixed', 'hslfixed');
}

// handle a drag and drop event to set the current image
function gotFile(file) {

    // If it's an image file
	if (file.type === 'image') {
		
		fileURL = file.name;
		dirty = true;

		// convert the dom image data to a p5.js image
		var raw = new Image();
		raw.src = file.data;
		raw.onload = function () {
			// resize and render the image into the destination image for processing
			img_in.drawingContext.drawImage(raw, 0, 0, 256, 192);
		}
        
    } else {
      console.log('not an image!');
    }
}

function draw() {

	background(backgroundColor);

	if (ditherFactor != slider.value()) {
		ditherFactor = slider.value();
		dirty = true;
	}

	if (colorizeCells !== checkbox.checked()) {
		colorizeCells = checkbox.checked();
		dirty = true;
	}

	if (colorSelection !== dropdown.selected()) {
		colorSelection = dropdown.selected();
		dirty = true;
	}

	if (dirty && fileURL !== '') {
		dirty = false;

		if (!colorizeCells) {
			processImageDither(img_in, img_out);
		}
		else if (colorSelection === 'hsl') {
			convertImage(img_in, img_out, rgb2hsl2light, rgb2hsl2dark);
		}
		else if (colorSelection === 'hslfixed') {
			convertImage(img_in, img_out, rgb2hsl2light, null);
		}
		else if (colorSelection === 'rgb') {
			convertImage(img_in, img_out, rgb2light, rgb2dark);
		}
		else {
			convertImage(img_in, img_out, rgb2light, null);
		}
	}

	fill(255);
  	noStroke();
  	textSize(18);
  	textAlign(CENTER);
	text('Drag an image file here', width / 2, height / 2);
    
	image(img_out, 0, 0, img_out.width * 2, img_out.height * 2);
}