import { useState, useEffect } from "react";
import Card from "../Components/Card";
import { hamburguesas } from "../data/data";
import Additions from "./Additions";
import Navbar from "../Components/Navbar";
import Buscar from "../Components/Buscar";
import Nav from "../Components/Nav";
import ShoppingCart from "./ShoppingCart";
import Form from "./Form";
import LoadingPage from "../Components/LoadingPage";

export default function Home() {
  const [click, SetClick] = useState(false);
  const [ver, setVer] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [selectedBurger, setSelectedBurger] = useState({});
  const onCliked = (hamburguesa) => {
    setSelectedBurger(hamburguesa);
    SetClick(true);
  };
  const abrirForm = () => {
    setOpenForm(true);
  };
  const mostrar = () => {
    setVer(true);
  };

  const cerrarCarrito = () => {
    setVer(false);
  };
  const cerrarForm = () => {
    setOpenForm(false);
  };
  const cerrar = () => {
    SetClick(false);
  };
  // const agregar=(nombre)=>{
  //   setName(nombre)
  //   console.log(nombre);
  // }
  const [texto, setTexto] = useState("");
  const onChangeText = (text) => {
    setTexto(text);
  };

  const filterBurger = hamburguesas.filter((objeto) => {
    return objeto.name.toLowerCase().includes(texto.toLowerCase());
  });
  const [loading, setLoading] = useState(true); // Estado para controlar la carga

  useEffect(() => {
    // Simular carga de datos (aquí podrías hacer una solicitud a una API, por ejemplo)
    setTimeout(() => {
      setLoading(false); // Cambia el estado de carga a falso después de un tiempo simulado
    }, 500); // Simular una carga de 2 segundos
  }, []); // Se ejecuta solo una vez al montar el componente

  return (
    <div className="relative flex items-center justify-center md:flex ">
      <div className="w-[1000px] text-[20px] ">
        {loading ? ( // Si está cargando, muestra el componente de carga
          <LoadingPage />
        ) : (
          <>
            {click === false ? (
              <div>
                <Navbar></Navbar>
                {ver === true || openForm === true ? (
                  ""
                ) : (
                  <>
                    <div className="flex justify-center">
                      <Buscar onChangeText={onChangeText}></Buscar>
                    </div>
                    <h1 className="font-bold text-[#FF7A21] text-2xl mt-5 text-center ">
                      Burger Menu
                    </h1>
                    <Nav mostrar={mostrar}></Nav>
                  </>
                )}

                {ver === true ? (
                  <ShoppingCart
                    cerrar={cerrar}
                    abrirForm={abrirForm}
                    cerrarCarrito={cerrarCarrito}
                  ></ShoppingCart>
                ) : (
                  ""
                )}
              </div>
            ) : (
              ""
            )}
            <div className="flex-wrap justify-center lg:flex md:flex ">
              {click === true ? (
                <Additions
                  cerrar={cerrar}
                  hamburger={selectedBurger}
                ></Additions>
              ) : (
                filterBurger.map((hamburger, i) =>
                  ver === true ? (
                    ""
                  ) : openForm === true ? (
                    ""
                  ) : (
                    <div
                      key={i}
                      className="transition duration-200 transform hover:scale-95 active:translate-y-1"
                    >
                      <Card
                        hamburger={hamburger}
                        onCliked={() => onCliked(hamburger)}
                      >
                        {" "}
                      </Card>
                    </div>
                  )
                )
              )}
            </div>
            {openForm === true ? (
              <Form cerrar={cerrar} cerrarForm={cerrarForm}></Form>
            ) : (
              ""
            )}
          </>
        )}
      </div>
    </div>
  );
}
