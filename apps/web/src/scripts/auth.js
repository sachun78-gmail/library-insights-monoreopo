import { supabase } from '../lib/supabase';

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-container');
  const closeAuthButton = document.getElementById('close-auth');
  const authForm = document.getElementById('auth-form');
  const authMessage = document.getElementById('auth-message');
  const googleSignInBtn = document.getElementById('google-signin-btn');
  const signInButton = document.getElementById('signin-btn');

  // Open auth modal
  if (signInButton) {
    signInButton.addEventListener('click', () => {
      authContainer.classList.remove('hidden');
    });
  }

  // Close auth modal
  if (closeAuthButton) {
    closeAuthButton.addEventListener('click', () => {
      authContainer.classList.add('hidden');
      authMessage.classList.add('hidden');
      authForm.reset();
    });
  }

  // Google Sign In
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        authMessage.textContent = error.message;
        authMessage.classList.remove('hidden');
        console.error('Google login error:', error.message);
      }
    });
  }

  // Email Sign In
  if (authForm) {
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      authMessage.classList.add('hidden');

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        authMessage.textContent = error.message;
        authMessage.classList.remove('hidden');
        console.error('Login error:', error.message);
      } else {
        authMessage.textContent = 'Login successful! Redirecting...';
        authMessage.classList.remove('hidden');
        authMessage.classList.remove('text-red-500');
        authMessage.classList.add('text-green-500');
        console.log('Login successful:', data);

        setTimeout(() => {
          authContainer.classList.add('hidden');
          authForm.reset();
          authMessage.classList.add('hidden');
          authMessage.classList.add('text-red-500');
          authMessage.classList.remove('text-green-500');
        }, 1500);
      }
    });
  }
});
