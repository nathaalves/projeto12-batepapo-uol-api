import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from 'dotenv';
import cors from "cors";
import joi from "joi";
import timeNow from './utils/timeNow.js';

dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

const client = new MongoClient(process.env.URL_CONNECT_MONGO)
let db;

client.connect().then( () => {
    db = client.db('batepapo');
});

server.post( '/participants', (request, response) => {

    const { name } = request.body;

    const psrticipantsSchema = joi.object({
        name: joi.string().required()
    });

    const { error } = psrticipantsSchema.validate({ name });

    if ( error ) {
        response.status(422).send(error.details[0].message);
        return;
    };

    db.collection('participants').count( { name }, { limit: 1}).then( participant => {

        if (parseInt(participant)) {
            response.status(409).send('Usuário já cadastrado!');
            return;
        };

        db.collection('participants').insertOne({
            name,
            lastStatus: Date.now()
        });
    
        db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: timeNow()
        });
    
        response.sendStatus(201);
    });
});

server.get('/participants', (request, response) => {

    db.collection('participants').find().toArray().then( participants => {
        response.send(participants);
    });
});

server.post( '/messages', (request, response) => {

    const { to, text, type} = request.body;
    const from = request.header("User");

    const messagesSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    });

    const { error } = messagesSchema.validate({ to, text, type });

    if ( error ) {
        response.sendStatus(422);
        return;
    };

    db.collection('participants').count( { name: from }, { limit: 1}).then( participant => {

        if (!parseInt(participant)) {
            response.sendStatus(422);
            return;
        };

        db.collection('messages').insertOne({
            to,
            from,
            text,
            type,
            time: timeNow()
        }).then( () => {
            response.status(201).send();
        });
    });
});

server.get( '/messages', (request, response) => {

    const user = request.header("User");
    const limit = request.query.limit;

    const condition = 
        { $or: [
            { type: 'status'},
            { to: { $in: [user, 'Todos'] }},
            { from: user }
        ]}
    
    db.collection('messages').find( condition ).toArray().then( messages => {
        if (limit) {
            const forSend = [...messages].splice(messages.length - limit, limit);
            response.send(forSend);
        } else {
            response.send(messages);
        };
    });
});

server.post( '/status', async (request, response) => {

    const user = request.header("User");
    const participants = await db.collection('participants').find({name: user});

    if (!participants) {
        response.sendStatus(404);
        return;
    }

    db.collection("participants").updateOne({name: user}, { $set: {lastStatus: Date.now()}}).then( () => {
        response.sendStatus(200);
    });
});

server.delete('/messages/:messageId', async (request, response) => {
    
    const user = request.header("User");
    const { messageId } = request.params;
    
    const messageIdSchema = joi.object({
        messageId: joi.string().min(24).hex()
    })
    
    const { error } = messageIdSchema.validate({ messageId });

    if ( error ) {
        response.sendStatus(404);
        return;
    }
    
    const messageForDelete = await db.collection('messages').findOne({ _id: ObjectId(messageId) });
    
    if (!messageForDelete) {
        response.sendStatus(404);
        return;
    };
    
    if (messageForDelete.from !== user) {
        response.sendStatus(401);
        return; 
    };
    
    await db.collection('messages').deleteOne({ _id: ObjectId(messageId) });
    response.sendStatus(200);
    
});

server.put('/messages/:messageId', async (request, response) => {
    
    const { to, text, type} = request.body;
    const user = request.header("User");
    const { messageId } = request.params;
    
    const messagesSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    });
    
    const { error } = messagesSchema.validate({ to, text, type });

    if ( error ) {
        
        response.sendStatus(422);
        return;
    };

    const participant = await db.collection('participants').find({ name: user });

    if (!participant) {
        
        response.sendStatus(422);
        return;
    };

    const message = await db.collection('messages').findOne({ _id: ObjectId(messageId) });
    
    if (message.from !== user) {
        response.sendStatus(401);
        return;
    };

    await db.collection('messages').updateOne({
        _id: ObjectId(messageId)
    }, { $set: {
        to,
        from: user,
        text,
        type,
        time: timeNow()
    }});

    response.sendStatus(200);
});
 
setInterval( async () => {

    const participants = await db.collection('participants').find({ lastStatus: {$lt: Date.now()-10000}}).toArray()
    await db.collection("participants").deleteMany( { lastStatus: { $lt: Date.now()-10000 }});
    
    if (participants.length) {
        participants.forEach( participant => {
            db.collection('messages').insertOne({
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: timeNow()
            });
        });
    };
    
}, 15000);

server.listen(5000);