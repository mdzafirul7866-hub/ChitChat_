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
    announcement: "🔥 ChitChat Official Club: नियमों का पालन करें और एन्जॉय करें!"
};

let messageHistory = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.emit('init_room', roomState);

    // यूज़र जॉइन होने पर (बिना डेटाबेस के)
    socket.on('join_room', (userData) => {
        socket.data.user = userData;
        socket.emit('wallet_update', { coins: 1000, role: userData.name === 'Admin' ? 'admin' : 'user' });
        io.emit('chat_message', { sender: 'System', text: `${userData.name} ऐप से जुड़ गए हैं।` });
    });

    // WebRTC Signaling
    socket.on('offer', (data) => {
        socket.to(data.target).emit('offer', { offer: data.offer, sender: socket.id });
    });

    socket.on('answer', (data) => {
        socket.to(data.target).emit('answer', { answer: data.answer, sender: socket.id });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, sender: socket.id });
    });

    // 9-Seat Stage Management
    socket.on('toggle_seat', ({ seatIndex }) => {
        const user = socket.data.user || { name: 'User' };
        if (roomState.seats[seatIndex]?.id === socket.id) {
            roomState.seats[seatIndex] = null;
        } else if (!roomState.seats[seatIndex]) {
            roomState.seats = roomState.seats.map(s => s?.id === socket.id ? null : s);
            roomState.seats[seatIndex] = { id: socket.id, name: user.name, muted: false };
        }
        io.emit('update_seats', roomState.seats);
    });

    // Security Rule Check for Calls
    app.post('/api/check-call-permission', (req, res) => {
        const { sender, receiver } = req.body;
        const key1 = `${sender}_${receiver}`;
        const key2 = `${receiver}_${sender}`;
        const canCall = messageHistory[key1] || messageHistory[key2] || false;
        res.json({ allowed: canCall });
    });

    socket.on('send_message', ({ receiver, text }) => {
        const user = socket.data.user || { name: 'Guest' };
        const key = `${user.name}_${receiver || 'Room'}`;
        messageHistory[key] = true;
        io.emit('chat_message', { sender: user.name, text });
    });

    // Gifting System
    socket.on('send_gift', ({ giftName, cost }) => {
        const user = socket.data.user;
        if (user) {
            io.emit('gift_broadcast', { sender: user.name, message: `🎁 ${user.name} ने शानदार ${giftName} भेजा है!` });
        }
    });

    // Super Admin Recharge Control
    socket.on('admin_recharge', ({ targetUser, amount, secretKey }) => {
        if (secretKey === 'my_secret_owner_password_123') {
            io.emit('chat_message', { sender: 'System', text: `✨ [Admin Control]: ${targetUser} के वॉलेट में ${amount} कॉइन्स जोड़ दिए गए हैं!` });
        } else {
            socket.emit('error_msg', 'गलत एडमिन पासवर्ड!');
        }
    });

    socket.on('disconnect', () => {
        roomState.seats = roomState.seats.map(s => s?.id === socket.id ? null : s);
        io.emit('update_seats', roomState.seats);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ChitChat Server running on port ${PORT}`));
