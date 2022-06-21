let socket = io({ autoConnect: false })
let $form = $('#messForm')
let $userName = $('#name')
let $message = $('#message')
let $allMessages = $('#all_mess')
let $file = $('#formFileSm')
let $buttonHistory = $('#buttonHistory')
let $fileBrowserBody = $('#fileBrowserModalBody')
let $blinking = $('#blinking')
let file
let users

/**
 * TODO:
 * ? Разбить по модулям шо можно
 * ? Перделки и свистелки (юзер печатает, кто зашел, кто вышел, скока онлайн) 
 */

const cleanInput = input => {
    return $('<div/>').text(input).html()
}

const setUserName = (err) => {
    $userName.val('')
    let dirtyUsername = prompt('Enter ur username')
    let username = cleanInput(dirtyUsername.trim())
    socket.auth = { username }
    socket.connect()
    $userName.val(username)
}

setUserName()

const blink_speed = 1000
const t = setInterval(() => {
    $blinking.css('visibility', $blinking.css('visibility') == 'hidden' ? '' : 'hidden')
}, blink_speed)

$buttonHistory.click(e => {
    e.preventDefault()
    socket.emit('get history', { room: 'general' })
})

function readFile(input) {
    file = input.files[0]
}

const socketSendPublicMessage = (data, type, filename = false) => {
    socket.emit('send message', {
        data,
        type,
        filename
    })
}

const socketSendPrivateMessage = (data, to, separator) => {
    socket.emit('private message', {
        data,
        to,
        separator
    })
}

const buildServiceMessageWindow = data => {
    let renderedMessage = `
        <div class="card">
            <div class="card card-body">
                <p class="card-text">${data}</p>
            </div>
        </div>
    `
    return renderedMessage
}

const buildPrivateMessageWindow = (data, from, separator) => {
    let message = data.split(separator)
    console.log(separator)
    console.log(message)
    let renderedMessage = `
        <div class="card">
            <div class="card-body">
                <h6 class="card-subtitle mb-2 text-muted">Private message from ${from}</h6>
                <p class="card-text">${message[1]}</p>
            </div>
        </div>
    `
    return renderedMessage
}

const buildMessageWindow = (data, name, type, my = false) => {
    let renderedMessage
    my ? renderedMessage = `<div class="card text-success">` : renderedMessage = `<div class="card">`
    renderedMessage += `
        <div class="card-body">
            <h6 class="card-subtitle mb-2 text-muted">${name}</h6>
    `
    if (type != 'text') {
        let fileForAppend
        type == '' ? fileForAppend = `${data}` : fileForAppend = `${data}.${type}`
        renderedMessage += `<a href="${FILE_HOST}/${fileForAppend}" target="_blank" class="link-info">${data}</a>`
    } else {
        renderedMessage += `<p class="card-text">${data}</p>`
    }
    renderedMessage += `</div></div>`
    return renderedMessage
}

const buildFileWindow = (data, name, type, my = false) => {
    let fileForAppend
    type == '' ? fileForAppend = `${data}` : fileForAppend = `${data}.${type}`
    let renderedMessage = `
        <div class="card card-body">
            <a href="${FILE_HOST}/${fileForAppend}" target="_blank" class="link-info">${data}</a>
        </div>
    `
    return renderedMessage
}

const renderList = (objectsFromDB, buildingFunction, appendBody) => {
    let collection = ``
    const snapshot = objectsFromDB
    for (const object in snapshot) {
        collection += buildingFunction(snapshot[object].data, snapshot[object].name, snapshot[object].type)
    }
    appendBody.html('')
    appendBody.append(collection)
}

const FILE_HOST = "http://localhost:3000/user_files"

$(function() {

    $form.submit(event => {
        event.preventDefault()
            //const nameSender = $userName.val() ? $userName.val() : 'Anonymous'
        if (file) {
            const fileObject = $file.val().replace(/^.*[\\\/]/, '')
            const fileName = fileObject.substring(0, fileObject.lastIndexOf('.')) || fileObject
            let fileType
            fileObject == fileName ? fileType = '' : fileType = fileObject.substring(fileObject.lastIndexOf('.') + 1, fileObject.length)
            if (fileType == 'text') {
                fileType = 'txt'
            }
            let reader = new FileReader()
            reader.readAsArrayBuffer(file)
            reader.onload = () => {
                socketSendPublicMessage(reader.result, fileType, fileName)
                $allMessages.append(buildMessageWindow(fileName, 'You', fileType, true))
                $allMessages.scrollTop($allMessages[0].scrollHeight)
            }
            reader.onerror = () => {
                console.log(reader.error);
            }
        } else {
            let message = cleanInput($message.val().trim())
            if (message.startsWith('@')) {
                //TODO
                let result = message.match(/@([^ ]*) /)
                if ((result[1] in users) && ($userName.val() !== result[1])) {
                    socketSendPrivateMessage(message, users[result[1]], result[0])
                    $allMessages.append(buildMessageWindow(message, 'You', 'text', true))
                    $message.val('')
                } else {
                    //TODO: Display service message
                    $allMessages.append(buildServiceMessageWindow(`Cannot send message to ${result[1]}`))
                }
            } else {
                socketSendPublicMessage(message, 'text')
                $allMessages.append(buildMessageWindow(message, 'You', 'text', true))
                $message.val('')
            }
            $allMessages.scrollTop($allMessages[0].scrollHeight)
        }
    });

    socket.once('initialize history', data => {
        $allMessages.prepend(buildMessageWindow(data.lastMessage.data, data.lastMessage.name, data.lastMessage.type))
    })

    socket.on('send files from chatroom', data => {
        console.log(data.filesFromGeneralChat)
        renderList(data.filesFromGeneralChat, buildFileWindow, $fileBrowserBody)
    })

    socket.on('send history', data => {
        console.log(data.roomHistory);
        renderList(data.roomHistory, buildMessageWindow, $allMessages)
    })

    socket.on('add message', data => {
        $allMessages.append(buildMessageWindow(data.data, data.name, data.type))
        $allMessages.scrollTop($allMessages[0].scrollHeight)
    })

    socket.on('private message', data => {
        $allMessages.append(buildPrivateMessageWindow(data.data, data.from, data.separator))
        $allMessages.scrollTop($allMessages[0].scrollHeight)
    })

    socket.on('user list', data => {
        console.log(data.users)
        users = data.users
    })

    socket.on("connect_error", err => {
        if (err.message === "invalid username") {
            alert('Invalid username')
            setUserName()
        }

        if (err.message === "name is already used") {
            alert('Name is already used. Please choose an another name')
            setUserName()
        }
    })
})