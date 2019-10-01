const puppeteer = require('puppeteer');
const pageURL = 'https://www.apmmusic.com/search/%5B%7B%22field%22%3A%22composer%22%2C%22value%22%3A%22Nathan%20Harrison%20Rightnour%22%2C%22operation%22%3A%22must%22%7D%5D';
const fs = require('fs');
let browser;
let page;

const runBot = async () => {
  try {
    browser = await launchBrowser();
    page = await launchPage(browser);
    const response = await page.goto(pageURL, {
      timeout: 0,
      waitUntil: 'networkidle2'
    });

    if (response.status() === 403) {
      console.log('Your ip Blocked by Website...');
    } else if (response.status() === 404) {
      console.log('Page Not Found...');
    } else {
      createCSVHeader();
      // Click Sort Button
      await page.waitForSelector('form.sort > .sort-wrapper > .sort-dropdown');
      await page.click('form.sort > .sort-wrapper > .sort-dropdown');
      await page.waitFor(1000);

      // Scroll to Page Bottom
      await scrollToBottom();
      await page.waitForSelector('.tracks.results-table');
      const tracks = await page.$$('.tracks.results-table > .item');
      console.log(tracks.length);
      for (let i = 0; i < tracks.length; i++) {
        // Get Basic Track Info
        console.log(`${i + 1}/${tracks.length} - Fetching Track Info...`);
        const trackInfo = {};
        trackInfo.art = await tracks[i].$eval(
            '.artwork > a > img',
            elm => elm.getAttribute('src')
        );
        trackInfo.trackname = await tracks[i].$eval(
            '.name > .track-title > strong',
            elm => elm.innerText.trim()
        );
        trackInfo.project = await tracks[i].$eval(
            '.name > .albumcode .library',
            elm => elm.innerText.trim()
        );
        trackInfo.tracknumber = await tracks[i].$eval(
            '.name > .albumcode .number',
            elm => elm.innerText.trim()
        );
        trackInfo.trackdescription = await tracks[i].$eval(
            '.description',
            elm => elm.innerText.trim()
        );
        trackInfo.duration = await tracks[i].$eval(
            '.duration',
            elm => elm.innerText.trim()
        );

        // Get Detail Track Info
        let downArrow = await tracks[i].$('.icon-arrow-down');
        await downArrow.click();
        await page.waitFor(1000);
        await page.waitForSelector('.track-details .more-control');
        await page.click('.track-details .more-control');
        
        trackInfo.company = await getCellVal('Library:');
        trackInfo.writers = await getCellVal('Composer:');
        trackInfo.publisher = await getCellVal('Publisher:');
        trackInfo.trackid = await getCellVal('Track Id:');
        trackInfo.apmreleasedate = await getCellVal('apm release date:');
        trackInfo.genre = await getCellVal('genre:');
        trackInfo.mood = await getCellVal('mood:');
        trackInfo.musicfor = await getCellVal('music for:');
        trackInfo.tempo = await getCellVal('tempo:');
        trackInfo.bpm = await getCellVal('bpm:');
        trackInfo.character = await getCellVal('character:');
        trackInfo.movement = await getCellVal('movement:');

        // Save Track Info to CSV
        updateCSV(trackInfo);

        downArrow = await tracks[i].$('.icon-arrow-down');
        await downArrow.click();
        await page.waitFor(1000);
      }
    }
    await page.close();
    await browser.close();
    return true;
  } catch (error) {
    console.log('Scraping Error: ', error)
    return error;
  }
};

const getCellVal = (label) => new Promise(async (resolve, reject) => {
  try {
    let returnVal = '';
    const props1 = await page.$$('.track-details > .table > .left-track-info .dl .row');
    for (let i = 0; i < props1.length; i++) {
      const propLabel = await props1[i].$eval('strong', elm => elm.innerText.trim().toLowerCase());
      if (propLabel == label.toLowerCase()) {
        returnVal = await props1[i].$eval(
            'span', elm => elm.innerText.trim()
        )
        return resolve(returnVal);
      }
    }

    const props2 = await page.$$('.track-details > .track-info-more .table > .dl:nth-of-type(2) > .row');
    
    for (let i = 0; i < props2.length; i++) {
      const propLabel = await props2[i].$eval('strong', elm => elm.innerText.trim().toLowerCase());
      if (propLabel == label.toLowerCase()) {
        const prop2ValNode = await props2[i].$('ul.terms-list');
        if (prop2ValNode) {
          returnVal = await props2[i].$$eval(
              'ul.terms-list > li',
              elms => elms.map(elm => elm.innerText.trim())
          )
          returnVal = returnVal.join(', ');
          return resolve(returnVal);
        } else {
          returnVal = await props2[i].$eval(
            'span', elm => elm.innerText.trim()
          )
          return resolve(returnVal);
        }
      }
    }
    resolve(returnVal);
  } catch (error) {
    console.log(`getCellVal(${label}) Error: ${error}`);
    reject(error);
  }
})


const scrollToBottom = () => new Promise(async (resolve, reject) => {
  let scrolledHeight = 0;
  let pageHeight = await page.evaluate('document.body.scrollHeight');
  do {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    scrolledHeight = pageHeight;
    await page.waitFor(4000);
    pageHeight = await page.evaluate('document.body.scrollHeight');
  } while (scrolledHeight < pageHeight);
  resolve(true);
})

function createCSVHeader() {
  if (fs.existsSync('results.csv')) fs.unlinkSync('results.csv');
  fs.writeFileSync('results.csv', '"Art","Track Name","Project","Track#","Track Description","Duration","Company","Writers","Publisher","Track ID","APM Release Date","Genre","Mood","Music For","Tempo","BPM","Character","Movement"\r\n');
}

function updateCSV(trackInfo) {
  fs.appendFileSync('results.csv', `"${trackInfo.art}","${trackInfo.trackname}","${trackInfo.project}","${trackInfo.tracknumber}","${trackInfo.trackdescription}","${trackInfo.duration}","${trackInfo.company}","${trackInfo.writers}","${trackInfo.publisher}","${trackInfo.trackid}","${trackInfo.apmreleasedate}","${trackInfo.genre}","${trackInfo.mood}","${trackInfo.musicfor}","${trackInfo.tempo}","${trackInfo.bpm}","${trackInfo.character}","${trackInfo.movement}"\r\n`);
}

const launchPage = (browser) => new Promise(async (resolve, reject) => {
  try {
    const page = await browser.newPage();
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36';
    await page.setUserAgent(userAgent);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });
    console.log('Launched Page');
    resolve(page);
  } catch (error) {
    console.log('Launch Page Error: ', error)
    reject(error);
  }
});

const launchBrowser = () => new Promise(async (resolve, reject) => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null,
    });
    console.log('Launched Browser');
    resolve(browser);
  } catch (error) {
    console.log('Browser Launch Error: ', error);
    reject(error);
  }
});

runBot();