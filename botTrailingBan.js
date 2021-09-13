// Modules
const express = require('express');
const path = require('path');
const axios = require('axios');

// Express Server configuration
const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


// Gecko request configuration
let date2 = new Date();
let dateOffset =  (24*60*60*1000)*90;
let date1 = new Date();
date1.setTime(date1.getTime()-dateOffset);

// console.log(date1.getTime(), date2.getTime()); //1620054000000  1627830000000
// console.log('período de la muestra en días:   ', (date2 - date1) / 3600000 / 24);

const urlBase = 'https://api.coingecko.com/api/v3';
const urlCommand = `/coins/bitcoin/market_chart/range?vs_currency=usd&from=${date1.getTime() / 1000}&to=${date2.getTime() / 1000}`;


// Gecko data request (main)
axios.get(urlBase + urlCommand)
  .catch(function (err) {
    return console.error(err);
  })
  .then(function (response) {
    // console.log('aprox. minutos entre muestras:  ', (response.data.prices[1][0] - response.data.prices[0][0]) / 1000 / 60);

    // response.data.prices.forEach((value, index, array) => {
    //   var temp = new Date(array[index][0]).toISOString();
    //   console.log(temp, array[index][1]);
    // });

    const times = response.data.prices.map((value, index, array) => {
      return new Date(array[index][0]).toISOString();
    });

    // console.log(times);

    const { tick, price, operations } = botTrailingBan(response);
    // console.log(tick);
    // console.log(price);
    // console.log(operations)

    const pricePercent = price.map((value, index, array) => {
      return (value - array[0]) / array[0] * 100;
    });

    const operationsPercent = operations.map((value, index, array) => {
      if (!isNaN(value)) return pricePercent[index]; 
    });
    
    plot(tick, times, pricePercent, operationsPercent);

  });



// Bot
function botTrailingBan(response) {
  // console.log('hola mundo');
  // console.log(response.data.prices[1][0]);

  let tick = [];
  const tickLen = response.data.prices.length;
  console.log(`ticklen: ${tickLen}`);
  for (let i = 0; i < tickLen; i++) {
    tick.push(i);
  }

  let price = response.data.prices.map((value) => value[1]);
  const initPrice = price[0];


  //const initPrice = 50000;
  const initAssetQty = 0.001;
  let assetQty = initAssetQty;
  let baseQty = initAssetQty * initPrice;
  let assetStep = 0.0002;
  const trailing = 0.001; //1%
  const trailingBan = 0.001 //0.2%

  // //Perfil de price
  // const price = [];
  //   for (let i = 0; i < tickLen; i++) {
  //   if (i == 0) {
  //     price.push(initPrice);
  //   } else {
  //     //price.push(price[i - 1] * (1 + (Math.random()*2-1)*0.3/100) ); // maxima variación por click +-0.3
  //     price.push(price[0] * (1 + 10/100*(Math.sin(100*2*Math.PI*i/tickLen)))); 
  //     // price.push(price[0] * (1 + 10/100*(Math.sin(100*2*Math.PI*i/tickLen)) + 20/100*i/tickLen));
  //     // price.push(price[0] * (1 + 10/100*(Math.sin(100*2*Math.PI*i/tickLen)) - 20/100*i/tickLen));
  //   }
  // }


  //Análisis y operaciones
  let operations = [];
  for (let i = 0, i_min = 0, i_max = 0, i_buy = 0, i_sell = 0, status = 'INIT'; i < tickLen; i++) {

    if ((status == 'SELL' || status == 'INIT') &&
      price[i] > price[i_max]) { //trailing SELL
      i_max = i;
      operations.push(NaN);
    }

    else if ((status == 'SELL' || status == 'INIT') &&
      price[i] < (price[i_max] * (1 - trailing)) &&
      price[i] > (price[i_buy] * (1 + trailingBan))) { //SELL
      i_min = i;
      i_sell = i;
      operations.push(-1);
      assetQty = assetQty - assetStep;
      baseQty = baseQty + assetStep * price[i];
      status = 'BUY';
    }

    else if ((status == 'BUY' || status == 'INIT') &&
      price[i] < price[i_min]) { //trailing BUY
      i_min = i;
      operations.push(NaN);
    }

    else if ((status == 'BUY' || status == 'INIT') &&
      price[i] > (price[i_min] * (1 + trailing)) &&
      price[i] < (price[i_sell] * (1 - trailingBan))) { //BUY
      i_max = i;
      i_buy = i;
      operations.push(1);  //antes 1
      assetQty = assetQty + assetStep;
      baseQty = baseQty - assetStep * price[i];
      status = 'SELL';
    }
    else {
      operations.push(NaN);
    }
  }

  console.log('assetStep: ', assetStep, ' (assetQty p/operation)');
  console.log('buy operations: ', operations.reduce((suma, valor) => suma + (valor == 1), 0));
  console.log('sell operations: ', operations.reduce((suma, valor) => suma + (valor == -1), 0));
  console.log('assetQty: ', initAssetQty.toFixed(5), '-->', assetQty.toFixed(5));
  console.log('baseQty: ', (initAssetQty * initPrice).toFixed(2), '-->', baseQty.toFixed(2));
  console.log('balance in assetQty :',
    (initAssetQty + initAssetQty).toFixed(5),
    '-->',
    (assetQty + baseQty / price[tickLen - 1]).toFixed(5));
  console.log('balance in baseQty :',
    (initAssetQty * initPrice + initAssetQty * initPrice).toFixed(2),
    '-->',
    (baseQty + assetQty * price[tickLen - 1]).toFixed(2));

  return { tick, price, operations };
}


// Express Server for plot
function plot(tick, times, pricePercent, operationsPercent) {
  // console.log(`times ${times}`);
  // console.log(`price percent ${pricePercent}`);
  app.use('/data', (req, res) => {
    let dataPlot = { xdata: times, ydata: pricePercent, zdata: operationsPercent};
    res.json(dataPlot);
  })

  app.use('/', (req, res) => {
    console.log('Entró ...');
    res.render('app', { mensaje: 'Hola mundo' });
  })

  app.listen(process.env.PORT, () => {
    console.log('App funcionando bien');
  })
}
