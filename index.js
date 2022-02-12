const express = require("express");
const redis =  require("redis");
const fetch = require("node-fetch");
const { json } = require("express/lib/response");
const { promisifyAll } = require('bluebird');

promisifyAll(redis);

const SERVER_PORT = process.env.PORT || 3000;

const client = redis.createClient({url: 'redis://127.0.0.1:6379/0'});

(async () => {
    await client.connect();
})();

client.on('connect', () => console.log('::> Redis Client Connected'));
client.on('error', (err) => console.log('<:: Redis Client Error', err));


const app = express();
app.use(express.json());

const getRepoCount = async (req, res, next) => {
    try {
        const { username } = req.params;
        console.log(`::> Fetching data for user: ${username}`);

        const response = await fetch(`https://api.github.com/users/${username}`);
        const data = await response.json();
        const repos = data.public_repos;

        // Saving to redis
        client.setEx(username, 3600, repos);


        res.status(200).send({repo_count: repos});
    } catch (error) {
        console.error(`<:: Error \n${error}`);
        res.status(500).send({error: error.message});
    }
}

const cachingMiddleware = async (req, res, next) => {
    const { username } = req.params;

    // Fetching from redis
    const data = await client.get(username);
    
    if(data !== null) {
        res.status(200).send({repo_count: data});
    }else {
        next();
    }
}



app.get('/repos/:username', cachingMiddleware ,getRepoCount);




app.listen(SERVER_PORT, ()=> {
    console.log(`Server listening on port: ${SERVER_PORT}`);
});