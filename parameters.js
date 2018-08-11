module.exports = {
    'initialScore': 5,
    'skipImage': 3, // minus 3
    'getHint': 1, // minus 1
    'poorAnswer': 2, // minus 2; if distance between user's marker and actual place is >=50% of city diagonal (km)
    'fairAnswer': 2, // plus 2; if distance between user's marker and actual place is >=10% and <50% of city diagonal (km)
    'goodAnswer': 5, // plus 5; if distance between user's marker and actual place is <10% of city diagonal (km)
    'goodAnswerLowerLimit': 0.1,
    'fairAnswerLowerLimit': 0.3,
};