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

const setUserName = (err) => {
    $userName.val('')
    let username = prompt('Enter ur username')
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

const socketSendMessage = (data, type, filename = false) => {
    socket.emit('send message', {
        data,
        type,
        filename
    })
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
    for (const object in objectsFromDB) {
        collection += buildingFunction(objectsFromDB[object].data, objectsFromDB[object].name, objectsFromDB[object].type)
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
                socketSendMessage(reader.result, fileType, fileName)
                $allMessages.append(buildMessageWindow(fileName, 'You', fileType, true))
                $allMessages.scrollTop($allMessages[0].scrollHeight)
            }
            reader.onerror = () => {
                console.log(reader.error);
            }
        } else {
            socketSendMessage($message.val(), 'text')
            $allMessages.append(buildMessageWindow($message.val(), 'You', 'text', true))
            $allMessages.scrollTop($allMessages[0].scrollHeight)
            $message.val('')
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

    socket.on("connect_error", err => {
        if (err.message === "invalid username") {
            alert('Invalid username')
            setUserName()
        }
    })
})