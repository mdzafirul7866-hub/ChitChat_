const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

let roomState = {
    membersCount: 1845,
    seats: Array(9).fill(null),
    announcement: "🔥 ChitChat Official Room 🔥"
};

let messageHistory = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('send_message', ({ receiver, message }) => {
        const user = socket.data.user || { name: 'Guest' };
        const key = `${user.name}_${receiver}`;
        messageHistory[key] = true;
        io.emit('chat_message', { sender: user.name, message });
    });

    // Gifting System
    socket.on('send_gift', ({ giftName, receiver }) => {
        const user = socket.data.user;
        if (user) {
            io.emit('gift_broadcast', { sender: user.name, giftName, receiver });
        }
    });

    // Super Admin Recharge Control
    socket.on('admin_recharge', ({ targetUser, amount, secretKey }) => {
        if (secretKey === 'my_secret_owner_key') {
            io.emit('chat_message', { sender: 'System', message: `${targetUser} recharged ${amount} coins!` });
        } else {
            socket.emit('error_msg', 'Galat Admin Key!');
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        roomState.seats = roomState.seats.map(seat => seat && seat.socketId === socket.id ? null : seat);
        io.emit('update_seats', roomState.seats);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
