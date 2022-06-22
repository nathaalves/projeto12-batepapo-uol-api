import express from "express";
import cors from "cors";
import fs from 'fs';
import dayjs from "dayjs";

const server = express();

server.use(cors())
server.use(express.json());

let participants = JSON.parse(fs.readFileSync('participants.json', 'utf-8'));
let messages = JSON.parse(fs.readFileSync('messages.json', 'utf-8'));

server.post( '/participants', (request, response) => {

    const { name } = request.body;

    if (!name) {
        response.status(422).send("Campo obrigatório");
        return
    }

    participants.push({
        name: name,
        lastStatus: Date.now()
    });
    fs.writeFileSync('participants.json', JSON.stringify(participants, null, 2));

    messages.push({
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`
    });
    fs.writeFileSync('messages.json', JSON.stringify(messages, null, 2))

    response.status(201).send();
})

server.get('/participants', (request, response) => {

    response.send(participants);
});

server.post( '/messages', (request, response) => {

    const { to, text, type} = request.body;
    
    const from = request.header("User");

    messages.push({
        to,
        from,
        text,
        type,
        time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`
    });
    fs.writeFileSync('messages.json', JSON.stringify(messages, null, 2));
    
    response.status(201).send();
});





server.listen(5000);
