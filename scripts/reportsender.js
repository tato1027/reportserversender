// Temp directory
const tmpDir = '/tmp/reports/';

// Chromium path
const chromium = '/usr/lib64/chromium-browser/chromium-browser';

// Reports server credentials
var username = 'username';
var password = 'password';

// SMTP setting
const smtpHost = 'mailserver.domain';
const smtpPort = 25;
const smtpFrom = 'address@domain';

process.env.TZ = 'Europe/Moscow';
var time = new Date();

const {parseArgs} = require('node:util');
const args = process.argv;
const options = {
    url: {
        type: 'string',
        short: 'u'
    },
    delay: {
        type: 'string',
        short: 'd'
    },
    format: {
        type: 'string',
        short: 'f'
    },
    landscape: {
        type: 'boolean',
        short: 'l'
    },
    scale: {
        type: 'string',
        short: 's'       
    },
    recipients: {
        type: 'string',
        short: 'r'     
    }
};
const {
    values
} = parseArgs({args, options,allowPositionals:true});

try {
    if (!(values.url) || !(values.recipients)) {
        throw new ReferenceError('Wrong parameters');
    }
}
catch (e) {
    if (e.name == 'ReferenceError') {
        console.error('Error! URL and Recipients parameters are required')
    }
    return
}

console.log(values)

// Parameters
var url = values.url;
var delay = (Math.round(values.delay))*1000 || 10000; //default 10000ms
var format = values.format || 'a4';
var landscape = values.landscape || false;
var scale = Math.round(values.scale) || 100;
var height;
var width;
var recipients = values.recipients;

if (format.toLowerCase() == 'a4' && landscape == false) {
    height = 1754;
    width = 1240;
}
else if (format.toLowerCase() == 'a4' && landscape == true) {
    height = 1240;
    width = 1754;   
}
else if (format.toLowerCase() == 'a3' && landscape == false) {
    height = 2480;
    width = 1754; 
}
else if (format.toLowerCase() == 'a3' && landscape == true) {
    height = 1754;
    width = 2480; 
}

// Prepare report name and URL
regexp = /([^/]*)$/i;
var reportName;
var subject;
reportName = url.match(regexp);
reportName = decodeURI(reportName[0]);
subject = reportName;
reportName = reportName + '_' + time.getFullYear() + '-' + time.getMonth() + '-' + time.getDate() + '_' + 
	time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds();
fullScreenUrl = url + '?rs:embed=true';

try {
    getReport();
} 
catch(e) {
    console.log(e);
}

// Get PDF and PNG
async function getReport() {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
        executablePath: chromium,
        headless: true,
	//args: ['--no-sandbox'],    
	ignoreHTTPSErrors: true
    });
    const page = await browser.newPage();   
    await page.authenticate({
        username: username,
        password: password
    });
    await page.setDefaultNavigationTimeout(120000),	
    await page.goto(fullScreenUrl);
    //await page.waitForNavigation({
    //    waitUntil: 'networkidle2'
    //});
    await sleep(delay);
    await page.emulateMediaType('screen');
    await page.setViewport({ width: width, height: height});

    await page.pdf({
        path: tmpDir + reportName + '.pdf',
        printBackground: true,
        scale: scale/100,
        landscape: landscape,
        format: format
    });

    await page.screenshot({
        path: tmpDir + reportName + '.png',
        //fullPage: true
    });

    await browser.close();

    await sendReport()
}

// Send report by SMTP
async function sendReport() {
    const nodemailer = require('nodemailer');
    let transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false
    });

    let result = await transporter.sendMail({
        from: smtpFrom,
        to: recipients,
        subject: subject,
        html: '<h2 style="color: #233142;">' + subject + '</h2>' + 
	    '<a href="' + url + '" style="padding: 10px 20px; border-radius: 4px; color: #eeeeee; background-color: #455d7a; text-decoration: none;">Open</a>' +
	    '<p style="color: #233142;">Report in pdf format attached</p>' +
	    '<img src="cid:img" style="width: 55vw; min-width: 400px;"/>' + 
	    '<p style="width: 55vw; min-width: 400px; color: #85929e; font-size: xx-small;">This email is automatically generated.</p>',
        attachments: [
            {
                filename: reportName + '.pdf',
                path: tmpDir + reportName + '.pdf'
            },
            {
                filename: reportName + '.png',
                path: tmpDir + reportName + '.png',
                cid: 'img'
            }
        ] 
    })
    
    console.log(result)
}

// Delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve,ms));
}