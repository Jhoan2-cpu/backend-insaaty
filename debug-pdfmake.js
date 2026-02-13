const fs = require('fs');
const path = require('path');

const fonts = {
    Roboto: {
        normal: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
        bold: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
        italics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
    }
};

// Update logging to write to file for reliability
const logFile = path.join(__dirname, 'debug-output.txt');
fs.writeFileSync(logFile, 'Starting debug...\n');

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

log('Testing pdfmake initialization...');
log('Fonts exist? ' + fs.existsSync(fonts.Roboto.normal));

try {
    log('Attempt 1: require("pdfmake")');
    const pdfmake = require('pdfmake');
    log('Type: ' + typeof pdfmake);
    log('Keys: ' + Object.keys(pdfmake));
    if (typeof pdfmake === 'function') {
        const printer1 = new pdfmake(fonts);
        log('Success 1 (as function)!');
    } else {
        log('Not a function.');
    }
} catch (e) {
    log('Fail 1: ' + e.message);
}

try {
    log('Attempt 2: require("pdfmake/src/printer")');
    const PdfPrinter2 = require('pdfmake/src/printer');
    const printer2 = new PdfPrinter2(fonts);
    log('Success 2!');
} catch (e) {
    log('Fail 2: ' + e.message);
}

try {
    log('Attempt 3: require("pdfmake/js/Printer")');
    const PdfPrinter3 = require('pdfmake/js/Printer');
    const printer3 = new PdfPrinter3(fonts);
    log('Success 3!');
} catch (e) {
    log('Fail 3: ' + e.message);
}

try {
    log('Attempt 4: require("pdfmake").default');
    const PdfPrinter4 = require('pdfmake').default;
    const printer4 = new PdfPrinter4(fonts);
    log('Success 4!');
} catch (e) {
    log('Fail 4: ' + e.message);
}
