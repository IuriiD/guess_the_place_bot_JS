module.exports = {
    'initialScore': 5,
    'skipImage': 3, // minus 3
    'getHint': 1, // minus 1
    'poorAnswer': 2, // minus 2; if distance between user's marker and actual place is >=fairAnswerLowerLimit (see below) of city diagonal (km)
    'fairAnswer': 2, // plus 2; if distance between user's marker and actual place is >=goodAnswerLowerLimit and <fairAnswerLowerLimit of city diagonal (km)
    'goodAnswer': 5, // plus 5; if distance between user's marker and actual place is <goodAnswerLowerLimit of city diagonal (km)
    'goodAnswerLowerLimit': 0.1,
    'fairAnswerLowerLimit': 0.3, //
    'usersTable': 'users', // name of table in DB
    'imageWidth': 600, // width of static maps and images from Google Street View, pixels
    'imageHeight': 400 // height of static maps and images from Google Street View, pixels
};