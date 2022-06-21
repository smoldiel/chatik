import express from 'express'
import http from 'http'
import cookieParser from 'cookie-parser'
import chalk from 'chalk'
import { OAuth2Client } from 'google-auth-library'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref, child, push, update, query, limitToLast, get } from "firebase/database"
import { appendFile } from 'node:fs/promises'

const __filename = fileURLToPath(
    import.meta.url)

const __dirname = path.dirname(__filename)

const port = process.env.PORT || 3000

const CLIENT_ID = '690604498042-u171b94ejc2t9p8j80dth655n20keism.apps.googleusercontent.com'

const HISTORY_LIMIT = 100

let lastMessage

let filesFromGeneralChat

let users = {}

const firebaseConfig = {
    apiKey: "AIzaSyAWM8Dl-nLo_N9eQXt9oHFvlSkKfMli7og",
    authDomain: "chatik-68e1c.firebaseapp.com",
    databaseURL: "https://chatik-68e1c-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "chatik-68e1c",
    storageBucket: "chatik-68e1c.appspot.com",
    messagingSenderId: "645351191132",
    appId: "1:645351191132:web:0b8987840a8b82799f2c99"
}

const fireApp = initializeApp(firebaseConfig)

const db = getDatabase(fireApp)

const lastMessageRef = ref(db, 'chats/general/lastMessage')
onValue(lastMessageRef, snapshot => {
    const data = snapshot.val()
    lastMessage = data
})

const filesFromGeneralChatRef = ref(db, 'files/general')
onValue(filesFromGeneralChatRef, snapshot => {
    const data = snapshot.val()
    filesFromGeneralChat = data
})

const app = express()
const server = http.createServer(app)
const io = new Server(server)

////////////////////////////////
////////!G-verification/////////
////////////////////////////////
const client = new OAuth2Client(CLIENT_ID);

const verifyUserToken = async token => {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID
    });
    const payload = ticket.getPayload();
    const userid = payload['sub']
    //?console.log('User ID: ', userid)
}

const checkUser = (req, res, next) => {
    res.locals.checkedUser ? next() : res.redirect('/login')
}

const wordCount = str => {
    return str.split(" ").length
}

////////////////////////////////
//////////!Middlewares//////////
////////////////////////////////
app.use(express.static(__dirname + '/public'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(async(req, res, next) => {
    const token = req.cookies.token
    try {
        await verifyUserToken(token)
        res.locals.checkedUser = true
    } catch (error) {
        res.locals.checkedUser = false
    }
    next()
})

//*Check unique username
io.use((socket, next) => {
    const username = socket.handshake.auth.username
    if (!username || wordCount(username) !== 1) {
        return next(new Error("invalid username"))
    }
    if (username in users) {
        return next(new Error("name is already used"))
    }
    socket.username = username;
    next()
})

////////////////////////////////
app.set('view engine', 'ejs')

////////////////////////////////
////!Endpoint for G-identity////
////////////////////////////////
app.post('/auth', async(req, res) => {
    const token = req.body.credential
    res.cookie('token', token)
    res.redirect('/chat')
})

////////////////////////////////
////////////!Routes/////////////
////////////////////////////////
app.get('/', checkUser, (req, res) => {
    res.redirect('/chat')
})

app.get('/login', (req, res) => {
    res.render('login')
})

app.get('/logout', (req, res) => {
    res.clearCookie('token')
    res.redirect('/login')
})

app.get('/chat', checkUser, (req, res) => {
    res.render('chat')
})

app.use((req, res) => {
    res.status(404)
    res.send('Not found')

})

////////////////////////////////
//////!Socket is working////////
////////////////////////////////
io.on('connection', socket => {
    console.log(chalk.bgBlueBright(`User ${socket.username} is connected`))

    users[socket.username] = socket.id

    io.emit('user list', { users })

    socket.emit('initialize history', { lastMessage })

    socket.emit('send files from chatroom', { filesFromGeneralChat })

    socket.broadcast.emit('enter user', { user: socket.username })

    socket.on('disconnect', data => {
        console.log(chalk.bgRedBright(`User ${socket.username} is disconnected`))
        delete users[socket.username]
        io.emit('user list', { users })
        socket.broadcast.emit('exit user', { user: socket.username })
    })

    socket.on('get history', data => {
        const roomHistoryRef = query(ref(db, `messages/${data.room}`), limitToLast(HISTORY_LIMIT))
        get(roomHistoryRef).then(snapshot => {
            if (snapshot.exists()) {
                const roomHistory = snapshot.val()
                socket.emit('send history', { roomHistory })
            } else {
                console.log('No data in firebase')
            }
        }).catch(err => {
            console.error(err)
        })
    })

    socket.on('private message', data => {
        socket.to(data.to).emit('private message', {
            data: data.data,
            from: socket.username,
            separator: data.separator
        })
    })

    socket.on('send message', async data => {

        if (data.type !== 'text') {
            //*Download file to server
            let file
            data.type == '' ? file = `${data.filename}` : file = `${data.filename}.${data.type}`
            try {
                await appendFile(`./public/user_files/${file}`, data.data)
                console.log("File has been saved")
            } catch (error) {
                console.log(error)
            }
            data.data = data.filename
        }

        const messageData = {
            data: data.data,
            name: socket.username,
            type: data.type
        }

        const messageKey = push(child(ref(db), 'message/general')).key
        const updates = {}
        updates[`messages/general/${messageKey}`] = messageData
        updates[`chats/general/lastMessage`] = messageData
        if (messageData.type !== 'text') {
            updates[`files/general/${messageKey}`] = messageData
        }
        update(ref(db), updates)

        socket.broadcast.emit('add message', { data: messageData.data, name: messageData.name, type: messageData.type })
        if (messageData.type !== 'text') {
            io.emit('send files from chatroom', { filesFromGeneralChat })
        }
    })
})

////////////////////////////////
//////////!Start server/////////
////////////////////////////////
server.listen(port, () => {
    console.log(chalk.bgGreen(`Server is running on localhost:${port}`))
})
