import express from 'express';
import mainRouter from './router';
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello World!');
});
mainRouter(app)
app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});