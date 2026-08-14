Retro Snake — Simple Web Game

Files added:
- index.html (/Users/kunal/proj/webapp/index.html)
- style.css (/Users/kunal/proj/webapp/style.css)
- game.js (/Users/kunal/proj/webapp/game.js)

How to run
1. Open the folder in any static-file-capable environment.
2. Double-click index.html or serve with a static server (e.g., python -m http.server).
3. Play the game in your browser.

Features
- Retro grid-based Snake on an HTML5 canvas
- Arrow keys or WASD controls; P to pause
- High scores are stored in localStorage (top 10) and displayed in a High Scores panel
- When the player achieves a high score, they're prompted for their name
- Responsive layout for small screens

Notes for developers
- High scores key in localStorage: "retro_snake_highscores_v1" (array of {name,score,date})
- To reset scores programmatically: localStorage.removeItem('retro_snake_highscores_v1') or use the in-app "Clear Scores" button
- The game uses a simple setInterval tick loop. If you want smoother timing, consider switching to requestAnimationFrame with accumulated delta logic.

Enjoy!
