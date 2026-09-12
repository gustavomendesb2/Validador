import { useState, useEffect } from "react";
import Validador from "./Validador";
import Painel from "./painel/Painel";
import { SLUG_PAINEL } from "./painel/slug";

// Roteamento simples: se o endereço começa com o slug secreto, é o painel do
// Gustavo. Qualquer outro endereço cai na tela de validação, que é a do sogro.
export default function App() {
  const [caminho, setCaminho] = useState(window.location.pathname);

  useEffect(() => {
    const aoVoltar = () => setCaminho(window.location.pathname);
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);

  const partes = caminho.split("/").filter(Boolean);

  if (partes[0] === SLUG_PAINEL) {
    return <Painel rota={partes.slice(1)} navegar={(p) => {
      const destino = "/" + [SLUG_PAINEL, ...p].join("/");
      window.history.pushState({}, "", destino);
      setCaminho(destino);
      window.scrollTo(0, 0);
    }} />;
  }

  return <Validador />;
}
