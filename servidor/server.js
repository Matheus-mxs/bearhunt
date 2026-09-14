const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.get("/", (req, res) => {
  res.json({ ok: true, jogo: "Bear Hunt", servico: "multiplayer" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const salas = new Map();

function gerarCodigoSala() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo;
  do {
    codigo = "";
    for (let i = 0; i < 5; i++) {
      codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
  } while (salas.has(codigo));
  return codigo;
}

function dadosDaSala(sala) {
  return {
    room: sala.codigo,
    players: [...sala.players.values()].map((jogador) => ({
      id: jogador.id,
      name: jogador.name,
      ready: jogador.ready,
      host: jogador.host
    }))
  };
}

function enviarAtualizacao(sala) {
  io.to(sala.codigo).emit("roomUpdated", dadosDaSala(sala));
}

function removerDaSala(socket) {
  const codigo = socket.data.room;
  if (!codigo || !salas.has(codigo)) return;

  const sala = salas.get(codigo);
  sala.players.delete(socket.id);
  socket.leave(codigo);
  socket.data.room = null;

  if (sala.players.size === 0) {
    salas.delete(codigo);
    return;
  }

  // Transfere a liderança para o jogador restante.
  const primeiro = sala.players.values().next().value;
  sala.players.forEach((jogador) => {
    jogador.host = jogador.id === primeiro.id;
  });
  enviarAtualizacao(sala);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }) => {
    if (socket.data.room) removerDaSala(socket);

    const nome = String(name || "").trim().slice(0, 18);
    if (!nome) return socket.emit("roomError", "Digite um nome ou apelido.");

    const codigo = gerarCodigoSala();
    const sala = {
      codigo,
      players: new Map(),
      started: false
    };

    sala.players.set(socket.id, {
      id: socket.id,
      name: nome,
      ready: false,
      host: true
    });
    salas.set(codigo, sala);
    socket.join(codigo);
    socket.data.room = codigo;
    socket.emit("roomCreated", dadosDaSala(sala));
  });

  socket.on("joinRoom", ({ name, room }) => {
    if (socket.data.room) removerDaSala(socket);

    const nome = String(name || "").trim().slice(0, 18);
    const codigo = String(room || "").trim().toUpperCase();
    const sala = salas.get(codigo);

    if (!nome) return socket.emit("roomError", "Digite um nome ou apelido.");
    if (!sala) return socket.emit("roomError", "Sala não encontrada.");
    if (sala.started) return socket.emit("roomError", "Essa partida já começou.");
    if (sala.players.size >= 2) return socket.emit("roomError", "Essa sala já está cheia.");

    sala.players.set(socket.id, {
      id: socket.id,
      name: nome,
      ready: false,
      host: false
    });
    socket.join(codigo);
    socket.data.room = codigo;
    socket.emit("roomJoined", dadosDaSala(sala));
    enviarAtualizacao(sala);
  });

  socket.on("toggleReady", ({ room, ready }) => {
    const sala = salas.get(String(room || "").toUpperCase());
    if (!sala || socket.data.room !== sala.codigo) return;
    const jogador = sala.players.get(socket.id);
    if (!jogador) return;
    jogador.ready = !!ready;
    enviarAtualizacao(sala);
  });

  socket.on("startGame", ({ room }) => {
    const sala = salas.get(String(room || "").toUpperCase());
    if (!sala || socket.data.room !== sala.codigo) return;
    const jogador = sala.players.get(socket.id);
    if (!jogador || !jogador.host) return socket.emit("roomError", "Somente o anfitrião pode iniciar.");
    if (sala.players.size < 2) return socket.emit("roomError", "É necessário ter 2 jogadores na sala.");
    if (![...sala.players.values()].every((item) => item.ready)) {
      return socket.emit("roomError", "Os dois jogadores precisam estar prontos.");
    }
    sala.started = true;
    io.to(sala.codigo).emit("gameStarting");
  });

  socket.on("leaveRoom", () => removerDaSala(socket));
  socket.on("disconnect", () => removerDaSala(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Bear Hunt multiplayer ativo na porta ${PORT}`);
});
