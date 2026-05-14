async function isAdminUser(user) {
    if (!user || user.isAnonymous) {
        return false;
    }

    const adminSnapshot = await db.collection('admins').doc(user.uid).get();
    return adminSnapshot.exists;
}

function setLoginMessage(message) {
    const messageElement = document.getElementById('error-message');
    if (messageElement) {
        messageElement.textContent = message;
    }
}

async function signInAdminWithGoogle() {
    try {
        if (auth.currentUser && auth.currentUser.isAnonymous) {
            await auth.signOut();
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        const credential = await auth.signInWithPopup(provider);
        const user = credential.user;

        if (await isAdminUser(user)) {
            window.location.href = '/admin';
            return;
        }

        setLoginMessage(`This Google account is signed in, but is not an admin yet. Add this UID to Firestore admins: ${user.uid}`);
    } catch (error) {
        console.error(error.message);
        setLoginMessage('Google sign-in failed. Please try again.');
    }
}

// Legacy email/password sign-in is kept in case you need to restore it later.
function signIn(email, password) {
    auth.signInWithEmailAndPassword(email, password)
        .then(async userCredential => {
            if (await isAdminUser(userCredential.user)) {
                window.location.href = '/admin';
                return;
            }

            setLoginMessage(`This account is signed in, but is not an admin yet. Add this UID to Firestore admins: ${userCredential.user.uid}`);
        })
        .catch((error) => {
            console.error(error.message);
            setLoginMessage('Invalid username or password.');
        });
}

// Sign Out
function signOut() {
    auth.signOut()
        .then(() => {
            // Signed out successfully
            // Redirect to the home page
            window.location.href = '/';
        })
        .catch((error) => {
            // Handle errors
            console.error(error.message);
        });
}
