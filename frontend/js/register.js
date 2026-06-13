(function () {
  const form = document.getElementById("registerForm");
  const msg = document.getElementById("authMsg");

  function setMsg(text, type = "info") {
    msg.className = `text-sm sm:text-base mt-2 ${
      type === "error" ? "text-red-300" : "text-[var(--muted)]"
    }`;
    msg.textContent = text;
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      fullName: document.getElementById("fullName").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      password: document.getElementById("password").value,
      confirmPassword: document.getElementById("confirmPassword").value,
    };

    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) return setMsg(data.message || "Registration failed", "error");

    // Store token
    localStorage.setItem("eventspace_token", data.token);
    localStorage.setItem("eventspace_role", "user");

    setMsg("Account created! Redirecting...", "success");

    // If there's a pending booking, redirect back to the calendar page
    const redirectUrl = localStorage.getItem(
      "eventspace_redirect_after_register"
    );
    if (redirectUrl) {
      localStorage.removeItem("eventspace_redirect_after_register");
      window.location.href = redirectUrl;
      return;
    }

    window.location.href = "/my-bookings.html";
  });
})();
