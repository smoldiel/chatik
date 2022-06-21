let text = 'Want to join us? If you have Google account just click button below :)'
let i = 0
let speed = 70

const typeWriter = () => {
    if (i < text.length) {
        document.getElementById("typing").innerHTML += text.charAt(i);
        i++;
        setTimeout(typeWriter, speed)
    }
}

window.onload = () => {
    typeWriter()
}