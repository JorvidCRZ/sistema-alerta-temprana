import { useState, type FormEvent } from "react";
import { actualizarRespuestaContacto, parsearFactoresRiesgo, registrarContacto, registrarTutoria, type Estudiante, type Motivo, type TipoContacto } from "../data";
import { Button, Icon, PageHeading } from "../components/common";
import { factorToReason, getTopRecommendation } from "./recommendations";

export function Communication({ student }: { student: Estudiante }) {
  const firstName = student.alumno.nombre.split(" ")[0];
  const dominantFactor = [...parsearFactoresRiesgo(student.riesgo.factores)].sort(
    (a, b) => Math.abs(b.valor) - Math.abs(a.valor),
  )[0];
  const reason = (dominantFactor && factorToReason(dominantFactor.familia)) ?? "Bajo rendimiento";
  const messageByReason: Record<Motivo, string> = {
    "Bajo rendimiento": `Estimada familia de ${firstName}: queremos coordinar acciones de acompañamiento para fortalecer su avance académico. Su participación nos ayudará a dar continuidad a los acuerdos.`,
    Inasistencias: `Estimada familia de ${firstName}: queremos conversar sobre la asistencia reciente y coordinar un acompañamiento que favorezca la continuidad de sus actividades escolares.`,
    Conducta: `Estimada familia de ${firstName}: queremos coordinar una conversación de acompañamiento sobre algunas situaciones observadas en el aula y acordar juntos los siguientes pasos.`,
    "Situación familiar": `Estimada familia de ${firstName}: queremos mantener una comunicación cercana para conocer si requieren algún apoyo y coordinar el acompañamiento de ${firstName}.`,
    Socioemocional: `Estimada familia de ${firstName}: queremos coordinar un espacio de conversación y acompañamiento para apoyar su bienestar y continuidad escolar.`,
    "Orientación vocacional": `Estimada familia de ${firstName}: queremos invitarlos a acompañar el proceso de orientación y exploración de intereses de ${firstName}.`,
  };
  const familyRecommendation = getTopRecommendation(student);
  const [channel, setChannel] = useState<TipoContacto>(
    familyRecommendation?.nombre === "Citación al apoderado" ? "Citacion" : "Mensaje",
  );
  const [message, setMessage] = useState(messageByReason[reason]);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const summary = `Promedio Bimestre 1 → Bimestre 2: ${student.alumno.promedios_bimestre.B1} → ${student.alumno.promedios_bimestre.B2}. Inasistencias: ${student.alumno.inasistencias}.`;
  const contacts = [...(student.contactos ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const submitContact = (event: FormEvent) => {
    event.preventDefault();
    registrarContacto(student.alumno.id_matricula, {
      fecha: new Date().toISOString().slice(0, 10),
      tipo: channel,
      detalle: message.trim(),
      respondio: false,
      resumen_datos: includeSummary ? summary : undefined,
    });
    setConfirmation("Contacto registrado. El envío es una simulación.");
  };

  return (
    <>
      <PageHeading title="Comunicación con familias" subtitle="Aviso de seguimiento para la familia" />
      <section className="communication-grid family-communication">
        <form className="card notice-composer" onSubmit={submitContact}>
          <div className="composer-header">
            <span className="composer-icon"><Icon name="family" /></span>
            <div><p className="section-label">Comunicación saliente</p><h2>Nuevo aviso</h2></div>
          </div>
          <div className="recipient">
            <span>Para</span>
            <div>
              <span className="student-avatar">{student.alumno.apoderado.nombres.split(" ").map((part) => part[0]).join("")}</span>
              <div><strong>{student.alumno.apoderado.nombres}</strong><small>{student.alumno.apoderado.parentesco} de {student.alumno.nombre}</small></div>
            </div>
          </div>
          <label className="form-field contact-channel">
            <span>Canal</span>
            <select value={channel} onChange={(event) => setChannel(event.target.value as TipoContacto)}>
              <option value="Llamada">Llamada</option>
              <option value="Mensaje">Mensaje (WhatsApp)</option>
              <option value="Citacion">Citación</option>
            </select>
          </label>
          <label className="message-field">
            <span>Mensaje</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} required />
            <small>Mensaje de acompañamiento precompletado según la información disponible.</small>
          </label>
          <label className="include-summary">
            <input type="checkbox" checked={includeSummary} onChange={(event) => setIncludeSummary(event.target.checked)} />
            <span>Incluir resumen de datos: {summary}</span>
          </label>
          <div className="composer-actions">
            <Button secondary onClick={() => setShowPreview((visible) => !visible)}>Vista previa móvil</Button>
            <Button type="submit" icon="send">Registrar contacto</Button>
          </div>
          {confirmation && <div className="pattern-confirmation" role="status"><Icon name="check" size={16} />{confirmation}</div>}
          <p className="mockup-note"><Icon name="info" size={16} /> Demostración sin envío real. El contacto se registra únicamente en este prototipo.</p>
        </form>
        <aside className="communication-side">
          {showPreview && (
            <article className="card mobile-preview">
              <div className="phone-speaker" />
              <p className="section-label">Vista previa móvil</p>
              <div className="mobile-recipient">
                <strong>{student.alumno.apoderado.nombres}</strong>
                <span>{channel === "Mensaje" ? "Mensaje (WhatsApp)" : channel === "Citacion" ? "Citación" : channel}</span>
              </div>
              <div className="message-bubble">
                <p>{message}</p>
                {includeSummary && <small>{summary}</small>}
              </div>
              <span className="preview-caption">Así verá la familia el contenido del aviso.</span>
            </article>
          )}
          <article className="card contact-history">
            <div className="card-header"><div><h2>Historial de contactos</h2><p>{student.alumno.nombre}</p></div></div>
            <div className="contact-list">
              {contacts.length > 0 ? contacts.map((contact) => (
                <div className="contact-item" key={contact.id}>
                  <div><strong>{contact.tipo === "Citacion" ? "Citación" : contact.tipo}</strong><span>{contact.fecha}</span></div>
                  <label className="response-switch">
                    <input
                      type="checkbox"
                      checked={contact.respondio}
                      onChange={(event) => actualizarRespuestaContacto(
                        student.alumno.id_matricula,
                        contact.id,
                        event.target.checked,
                      )}
                    />
                    <span>{contact.respondio ? "Respondió" : "Respuesta pendiente"}</span>
                  </label>
                </div>
              )) : <p className="empty-history">No hay contactos registrados.</p>}
            </div>
          </article>
        </aside>
      </section>
      <div className="human-note communication-note">
        <Icon name="info" />
        <p><strong>Acompañamiento familiar.</strong> No es una sanción. Canal solo del tutor hacia la familia.</p>
      </div>
    </>
  );
}

export function FollowUpModal({
  student,
  tutorName,
  close,
}: {
  student: Estudiante;
  tutorName: string;
  close: () => void;
}) {
  const [note, setNote] = useState("");
  const dominantFactor = [...parsearFactoresRiesgo(student.riesgo.factores)].sort(
    (a, b) => Math.abs(b.valor) - Math.abs(a.valor),
  )[0];
  const reason = (dominantFactor && factorToReason(dominantFactor.familia)) ?? "Bajo rendimiento";
  const saveFollowUp = (event: FormEvent) => {
    event.preventDefault();
    registrarTutoria(student.alumno.id_matricula, {
      fecha: new Date().toISOString().slice(0, 10),
      motivo: reason,
      accion: "Seguimiento semanal",
      derivacion: "Ninguna",
      mejoro_sim: false,
      nota: note.trim(),
      tutor: tutorName,
    });
    close();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <form className="followup-modal" role="dialog" aria-modal="true" aria-labelledby="followup-title" onSubmit={saveFollowUp} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="section-label">{student.alumno.nombre} · 3.º Sec. A</p><h2 id="followup-title">Registrar seguimiento</h2></div>
          <button type="button" className="modal-close" onClick={close} aria-label="Cerrar modal"><Icon name="close" /></button>
        </div>
        <p className="modal-description">Registra una observación que ayude a dar continuidad al acompañamiento. Evita diagnósticos o etiquetas.</p>
        <label className="observation-field">
          <span>Observaciones del tutor</span>
          <textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe las acciones realizadas, acuerdos o aspectos por revisar…" required />
        </label>
        <div className="modal-guidance"><Icon name="info" size={17} /> Toda decisión y registro requiere criterio profesional y revisión humana.</div>
        <div className="modal-actions"><Button secondary onClick={close}>Cancelar</Button><Button type="submit">Guardar seguimiento</Button></div>
      </form>
    </div>
  );
}

