import { useEffect, useState } from "react";
import {
  cargarHistorialEstudiante,
  cerrarSesion,
  restablecerDatosDemostracion,
  useDataStore,
} from "./data";import { Header, Sidebar, landingByRole, navigationByRole, type View } from "./components/common";
import { LoginPage } from "./features/auth";
import { AlertDetail, Dashboard, History, Students } from "./features/tutor";
import { Communication, FollowUpModal } from "./features/communication";
import { AccessDenied, DerivationsPage, ModelAndData, RegisterEvidence, TeacherDerivations, TeacherSection } from "./features/staff";

export default function App() {
  const data = useDataStore();
  const [view, setView] = useState<View>("dashboard");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showAutomaticAlert, setShowAutomaticAlert] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState(
    () => data.estudiantes[0]?.alumno.id_matricula ?? "",
  );
  const activeUser = data.usuarioActivo;
  const selectedStudent =
    data.estudiantes.find(
      (student) => student.alumno.id_matricula === selectedStudentId,
    ) ?? data.estudiantes[0];

  // Chip fijo en el header: solo indica el año/grado. El filtro por sección va en la tabla.
  const seccionChip = (() => {
    if (!activeUser) return undefined;
    const teacherProfile = data.docentes.find((d) => d.usuario_id === activeUser.id);
    if (teacherProfile) return `${teacherProfile.grado} · ${teacherProfile.seccion}`;
    return "3.º Secundaria";
  })();

  useEffect(() => {
    if (!activeUser || !selectedStudent) return;
    if (view === "alert" || view === "history") {
      void cargarHistorialEstudiante(selectedStudent.alumno.id_matricula);
    }
  }, [activeUser, selectedStudent?.alumno.id_matricula, view]);

  if (!activeUser) {
    return (
      <LoginPage
        users={data.usuarios}
        onLogin={(user) => {
          setView(landingByRole[user.rol]);
          setShowFollowUp(false);
        }}
      />
    );
  }
  const allowedViews = navigationByRole[activeUser.rol].map((item) => item.view);
  const canAccessView = allowedViews.includes(view);
  const derivations = data.estudiantes.flatMap((estudiante) => estudiante.derivaciones);
  const pendingDerivations = derivations.filter(
    (derivacion) => derivacion.estado === "Pendiente",
  ).length;
  const notificationCount =
    activeUser.rol === "Tutor"
      ? pendingDerivations + data.notificacionesTutor
      : activeUser.rol === "Docente"
        ? derivations.filter(
            (derivacion) =>
              derivacion.docente === activeUser.nombre && derivacion.cambio_estado,
          ).length
        : 0;

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openStudentView = (idMatricula: string, nextView: "alert" | "history") => {
    setSelectedStudentId(idMatricula);
    navigate(nextView);
  };
  const openSolutionView = (idMatricula: string) => {
    setSelectedStudentId(idMatricula);
    navigate("alert");
    window.setTimeout(
      () => document.getElementById("solucion-recomendada")?.scrollIntoView({ behavior: "smooth" }),
      0,
    );
  };

  const renderView = () => {
    if (!canAccessView) {
      return <AccessDenied goBack={() => navigate(landingByRole[activeUser.rol])} />;
    }

    if (view === "dashboard") {
      return (
        <Dashboard
          navigate={navigate}
          openAlert={(idMatricula) => openStudentView(idMatricula, "alert")}
          openSolution={openSolutionView}
          showAlert={showAutomaticAlert}
          dismissAlert={() => setShowAutomaticAlert(false)}
        />
      );
    }
    if (view === "students") {
      return (
        <Students
          openAlert={(idMatricula) => openStudentView(idMatricula, "alert")}
          openHistory={(idMatricula) => openStudentView(idMatricula, "history")}
          openSolution={openSolutionView}
        />
      );
    }
    if (view === "alert") {
      return selectedStudent ? (
        <AlertDetail
          student={selectedStudent}
          navigate={navigate}
          openFollowUp={() => setShowFollowUp(true)}
          canCommunicate={activeUser.rol === "Tutor"}
          canApply={activeUser.rol === "Tutor"}
          tutorName={activeUser.nombre}
        />
      ) : null;
    }
    if (view === "history") {
      return selectedStudent ? (
        <History
          student={selectedStudent}
          riskHistory={data.recalculosRiesgo[selectedStudent.alumno.id_matricula] ?? []}
          navigate={navigate}
          openFollowUp={() => setShowFollowUp(true)}
          canCommunicate={activeUser.rol === "Tutor"}
        />
      ) : null;
    }
    if (view === "communication") {
      return selectedStudent ? <Communication student={selectedStudent} /> : null;
    }
    if (view === "my-section") return <TeacherSection activeUser={activeUser} />;
    if (view === "evidence") return <RegisterEvidence activeUser={activeUser} />;
    if (view === "my-derivations") return <TeacherDerivations activeUser={activeUser} />;
    if (view === "derivations") {
      return <DerivationsPage readOnly={activeUser.rol === "Coordinacion"} activeUser={activeUser} />;
    }
    if (view === "model") return <ModelAndData />;
    return null;
  };

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        navigate={navigate}
        resetData={restablecerDatosDemostracion}
        role={activeUser.rol}
        pendingDerivations={pendingDerivations}
      />
      <div className="workspace">
        <Header
          activeUser={activeUser}
          notificationCount={notificationCount}
          logout={() => {
            cerrarSesion();
            setView("dashboard");
            setShowFollowUp(false);
          }}
          openNotifications={() => {
            if (activeUser.rol === "Docente") navigate("my-derivations");
            else if (activeUser.rol === "Tutor") navigate("derivations");
          }}
          seccionChip={seccionChip}
        />
        <main className="content">{renderView()}</main>
        <footer>Datos ficticios con fines demostrativos. Prototipo académico con identidad visual referencial del colegio.</footer>
      </div>
      {showFollowUp && selectedStudent && (
        <FollowUpModal
          student={selectedStudent}
          tutorName={activeUser.nombre}
          close={() => setShowFollowUp(false)}
        />
      )}
    </div>
  );
}
