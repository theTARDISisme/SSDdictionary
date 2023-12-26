// Sign In
function signIn(email, password) {
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in successfully
            const user = userCredential.user;
            console.log(user);

            // Redirect to the /admin page
            window.location.href = '/admin';
        })
        .catch((error) => {
            // Handle errors
            console.error(error.message);

            // Display error message
            document.getElementById('error-message').textContent = 'Invalid username or password.';
        });
}


// Sign Out
function signOut() {
    auth.signOut()
        .then(() => {
            // Signed out successfully
            console.log('User signed out');
            // Redirect to the home page
            window.location.href = '/';
        })
        .catch((error) => {
            // Handle errors
            console.error(error.message);
        });
}