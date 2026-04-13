const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { bootstrap } = require('./bootstrap');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join_kitchen', () => {
    socket.join('kitchen_room');
    console.log(`Socket ${socket.id} joined kitchen_room`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5006;

bootstrap()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error syncing database:', error);
    process.exit(1);
  });
