(function () {
  const form = document.getElementById("loginForm");
  const msg = document.getElementById("loginMsg");

  function setMsg(text, type = "info") {
    if (!msg) return;
    const cls = type === "error" ? "text-red-300" : "text-[var(--muted)]";
    msg.className = `text-sm ${cls}`;
    msg.textContent = text;
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
    };

    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) return setMsg(data.message || "Login failed", "error");

    localStorage.setItem("eventspace_token", data.token);
    const role = data.user?.role || "user";
    localStorage.setItem("eventspace_role", role);

    setMsg("Login successful. Redirecting...", "ok");

    // Support redirect-back into hall booking calendar flow
    const redirectUrl = localStorage.getItem("eventspace_redirect_after_login");
    if (redirectUrl) {
      localStorage.removeItem("eventspace_redirect_after_login");
      window.location.href = redirectUrl;
      return;
    }

    if (role === "admin") window.location.href = "/admin/dashboard.html";
    else window.location.href = "/my-bookings.html";
  });
})();
