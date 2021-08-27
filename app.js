const express = require('express');
const path = require('path');
const api = require('./api');

const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/data', async (req, res) => {
  const data = {
    xdata: [1,2,3,4,5,6,7,8,9],
    ydata: [1,4,9,16,25,36,49,64,81]
  };  
  res.json(data);
})

app.use('/', (req, res) => {
  console.log('Entró ...');
  res.render('app', { mensaje: 'Hola mundo'});
})

app.listen(process.env.PORT, () => {
  console.log('App funcionando bien');
})
