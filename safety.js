document.getElementById('safetyForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const place = document.getElementById('placeInput').value;
    // Dummy safety score logic
    const safetyScore = Math.floor(Math.random() * 100) + 1; // Random safety score between 1 and 100
    document.getElementById('safetyScore').textContent = `Safety Score: ${safetyScore}`;
});

document.getElementById('submitScoreForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const userScore = document.getElementById('userScoreInput').value;
    document.getElementById('safetyScore').textContent = `User Submitted Score: ${userScore}`;
});
