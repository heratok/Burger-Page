import { useState } from "react";
import Card from "../Components/Card";

import { hamburguesas } from "../data/data";
import Additions from "./Additions";
import Navbar from "../Components/Navbar";
import Buscar from "../Components/Buscar";
import Nav from "../Components/Nav";
export default function Home() {
  const [click, SetClick] = useState(false);
  const [selectedBurger, setSelectedBurger] = useState({});
  const onCliked = (hamburguesa) => {
    setSelectedBurger(hamburguesa)

    SetClick(true);
    
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
  return (
    <div className="relative  md:flex flex justify-center items-center ">
      <div className="  w-[1000px] text-[20px]">
        {click === false ? (
          <div>
            <Navbar></Navbar>
            <div className="flex justify-center">
              <Buscar onChangeText={onChangeText}></Buscar>
            </div>
            <h1 className="font-bold text-[#FF7A21] text-2xl mt-5 text-center">
              Burger Menu
            </h1>
            <Nav></Nav>
          </div>
        ) : (
          ""
        )}
        <div className=" lg:flex  md:flex   flex-wrap justify-center ">
          {click === true ? (
            <Additions cerrar={cerrar} hamburger={selectedBurger}  ></Additions>
          ) : (
            filterBurger.map((hamburger, i) => (
              <Card key={i} hamburger={hamburger} onCliked={()=> onCliked(hamburger)}>
                {" "}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
