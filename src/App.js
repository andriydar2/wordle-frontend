import React, { useState, useEffect } from "react";

const API =
  process.env.REACT_APP_API_URL || "https://dar.southcentralus.cloudapp.azure.com/api";

const CELL_STYLE = {
  width: "2.5em",
  height: "2.5em",
  margin: "0.15em",
  fontSize: "1.8em",
  fontWeight: "bold",
  textAlign: "center",
  border: "2px solid #ccc",
  borderRadius: "0.3em",
  textTransform: "uppercase",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const COLORS = {
  green: "#6aaa64",
  yellow: "#c9b458",
  gray: "#787c7e",
};

// Add ENTER and BKSP in the bottom row
const KEYBOARD_ROWS = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  ["ENTER", ..."ZXCVBNM".split(""), "BKSP"],
];

const KEY_STYLE = {
  minWidth: "2.2em",
  padding: "0.4em 0.5em",
  margin: "0.15em",
  borderRadius: "0.4em",
  border: "none",
  fontWeight: "bold",
  fontSize: "0.9em",
  textTransform: "uppercase",
  cursor: "pointer",
};

function App() {
  const [gameId, setGameId] = useState(null);
  const [guesses, setGuesses] = useState([]); // completed guesses: [{guess, feedback}]
  const [currentGuess, setCurrentGuess] = useState(""); // string being typed (max 5)
  const [status, setStatus] = useState("loading"); // loading | playing | won | lost
  const [message, setMessage] = useState("");
  const [tries, setTries] = useState(0);
  const [keyStatuses, setKeyStatuses] = useState({}); // { 'A': 'gray'|'yellow'|'green' }

  // Start game on mount
  useEffect(() => {
    fetch(`${API}/start`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        setGameId(data.game_id);
        setGuesses([]);
        setCurrentGuess("");
        setStatus("playing");
        setMessage("");
        setTries(0);
        setKeyStatuses({});
      })
      .catch(() => setMessage("Failed to start game."));
  }, []);

  // Update pseudo keyboard colors based on feedback
  const updateKeyboardStatuses = (guess, feedback) => {
    const priority = { gray: 0, yellow: 1, green: 2 };

    setKeyStatuses((prev) => {
      const next = { ...prev };
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i].toUpperCase();
        const fb = feedback[i]; // green / yellow / gray
        const current = next[letter];
        if (!current || priority[fb] > priority[current]) {
          next[letter] = fb;
        }
      }
      return next;
    });
  };

  const handleLetter = (letter) => {
    if (status !== "playing") return;
    if (currentGuess.length >= 5) return;
    setCurrentGuess((prev) => prev + letter.toLowerCase());
    setMessage("");
  };

  const handleBackspace = () => {
    if (status !== "playing") return;
    if (!currentGuess.length) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
    setMessage("");
  };

  const handleEnter = async () => {
    if (status !== "playing") return;
    if (currentGuess.length < 5) {
      setMessage("Not enough letters.");
      return;
    }

    try {
      const res = await fetch(`${API}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, guess: currentGuess }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.detail || "Error.");
        return;
      }
      const data = await res.json();
      const newEntry = { guess: currentGuess, feedback: data.feedback };
      setGuesses((g) => [...g, newEntry]);
      setTries(data.guesses);
      setCurrentGuess("");
      setMessage("");

      updateKeyboardStatuses(currentGuess, data.feedback);

      if (data.correct) {
        setStatus("won");
      } else if (data.guesses >= 6) {
        setStatus("lost");
      }
    } catch (err) {
      setMessage("Network error.");
    }
  };

  // Physical keyboard handling
  useEffect(() => {
    const onKeyDown = (e) => {
      if (status !== "playing") return;

      const key = e.key;

      if (/^[a-zA-Z]$/.test(key)) {
        e.preventDefault();
        handleLetter(key.toLowerCase());
      } else if (key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (key === "Enter") {
        e.preventDefault();
        handleEnter();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, currentGuess, gameId, guesses, keyStatuses]); // dependencies so it sees latest state

  const restart = () => {
    window.location.reload();
  };

  // Helper to render the letter in a given cell
  const getCellLetter = (rowIndex, colIndex) => {
    if (rowIndex < guesses.length) {
      return guesses[rowIndex].guess[colIndex] || "";
    }
    if (rowIndex === guesses.length && status === "playing") {
      return currentGuess[colIndex] || "";
    }
    return "";
  };

  // Helper to get feedback for a cell
  const getCellFeedback = (rowIndex, colIndex) => {
    if (rowIndex < guesses.length) {
      return guesses[rowIndex].feedback[colIndex];
    }
    return null;
  };

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 500,
        margin: "2em auto",
        textAlign: "center",
      }}
    >
      <h1>Wordle</h1>

      {/* GRID */}
      <div
        style={{
          marginTop: "1em",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {[...Array(6)].map((_, row) => (
          <div
            key={row}
            style={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            {Array(5)
              .fill("")
              .map((_, col) => {
                const fb = getCellFeedback(row, col);
                const letter = getCellLetter(row, col);
                return (
                  <span
                    key={col}
                    style={{
                      ...CELL_STYLE,
                      background: fb ? COLORS[fb] : "#fff",
                      color: fb ? "#fff" : "#222",
                    }}
                  >
                    {letter}
                  </span>
                );
              })}
          </div>
        ))}
      </div>

      {message && (
        <div style={{ color: "#b00", marginTop: "0.5em" }}>{message}</div>
      )}

      {/* RESULT */}
      {status === "won" && (
        <div
          style={{
            color: "#6aaa64",
            fontWeight: "bold",
            marginTop: "1em",
          }}
        >
          🎉 Correct!
          <div>
            <button onClick={restart} style={{ marginTop: "1em" }}>
              Play Again
            </button>
          </div>
        </div>
      )}
      {status === "lost" && (
        <div
          style={{
            color: "#b00",
            fontWeight: "bold",
            marginTop: "1em",
          }}
        >
          😢 Out of attempts!
          <div>
            <button onClick={restart} style={{ marginTop: "1em" }}>
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* ONSCREEN KEYBOARD */}
      <div style={{ marginTop: "2em" }}>
        {KEYBOARD_ROWS.map((row, idx) => (
          <div key={idx} style={{ marginBottom: "0.2em" }}>
            {row.map((key) => {
              if (key === "ENTER") {
                return (
                  <button
                    key={key}
                    onClick={handleEnter}
                    style={{
                      ...KEY_STYLE,
                      minWidth: "4em",
                      backgroundColor: "#d3d6da",
                    }}
                  >
                    Enter
                  </button>
                );
              }
              if (key === "BKSP") {
                return (
                  <button
                    key={key}
                    onClick={handleBackspace}
                    style={{
                      ...KEY_STYLE,
                      minWidth: "4em",
                      backgroundColor: "#d3d6da",
                    }}
                  >
                    ⌫
                  </button>
                );
              }

              const status = keyStatuses[key] || null;
              const bg = status ? COLORS[status] : "#d3d6da";
              const fg = status ? "#fff" : "#000";

              return (
                <button
                  key={key}
                  onClick={() => handleLetter(key.toLowerCase())}
                  style={{
                    ...KEY_STYLE,
                    backgroundColor: bg,
                    color: fg,
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
