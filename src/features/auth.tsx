import { useState, type FormEvent } from "react";
import { iniciarSesion, type Usuario } from "../data";
import { Button, roleLabels } from "../components/common";
import logo from "../imports/saco-oliveros-30.png";

export function LoginPage({
  users,
  onLogin,
}: {
  users: Usuario[];
  onLogin: (user: Usuario) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    const user = iniciarSesion(email, password);
    if (!user) {
      setError("Correo o contraseña incorrectos");
      return;
    }
    setError("");
    onLogin(user);
  };

  const fillCredentials = (user: Usuario) => {
    setEmail(user.correo);
    setPassword(user.clave);
    setError("");
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-heading">
          <div className="login-logo-wrap">
            <img src={logo} alt="Saco Oliveros" className="login-logo" />
          </div>
          <div>
            <p className="login-kicker">Portal del tutor</p>
            <h1 id="login-title">Sistema de Alerta Temprana</h1>
            <p>Ingresa con una cuenta ficticia para explorar el prototipo.</p>
          </div>
        </header>

        <div className="login-layout">
          <form className="login-form" onSubmit={submitLogin}>
            <label className="form-field">
              <span>Correo</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@saco.edu.pe"
                required
              />
            </label>
            <label className="form-field">
              <span>Contraseña</span>
              <span className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </span>
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <Button type="submit">Ingresar</Button>
          </form>

          <section className="demo-credentials" aria-labelledby="credentials-title">
            <div className="credentials-heading">
              <div>
                <p className="section-label">Acceso directo</p>
                <h2 id="credentials-title">Credenciales de prueba</h2>
              </div>
              <span>5 usuarios</span>
            </div>
            <div className="credentials-list">
              {users.map((user) => (
                <article className="credential-row" key={user.id}>
                  <div className="credential-person">
                    <strong>{roleLabels[user.rol]} · {user.nombre}</strong>
                    <span>{user.correo}</span>
                  </div>
                  <code>{user.clave}</code>
                  <button type="button" onClick={() => fillCredentials(user)}>Usar</button>
                </article>
              ))}
            </div>
            <p className="demo-footnote">Prototipo de demostración. Usuarios ficticios.</p>
          </section>
        </div>
      </section>
    </main>
  );
}

