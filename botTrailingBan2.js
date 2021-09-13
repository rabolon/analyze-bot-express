// Se remplaza la información de coingecko por la de binance

// Modules
const api = require('./api');
const express = require('express');
const path = require('path');
const axios = require('axios');

// Express Server configuration
const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


// main
async function run() {

  let endTime = new Date("2021/09/12 18:00:00").getTime();
  let startTime = endTime - (12 * 3600 * 1000);   // 12 horas

  result = await api.candleStickData('BTCUSDT', '1m', startTime, endTime, 1000);
  const response = result.map(value => value[4]);
  console.log(response);

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

  plot(tick, tick, pricePercent, operationsPercent);
}


// Bot
function botTrailingBan(response) {
  // console.log('hola mundo');
  // console.log(response.data.prices[1][0]);

  let price = response;
  const initPrice = price[0];

  let tick = [];
  tickLen = response.length;
  for (let i=0; i < tickLen; i++) tick.push(i);
  console.log(`ticklen: ${tickLen}`);
  
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
    let dataPlot = { xdata: times, ydata: pricePercent, zdata: operationsPercent };
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

run();
