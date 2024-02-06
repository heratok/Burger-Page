import { useState } from "react";
import Card from "../Components/Card";

import { hamburguesas } from "../data/data";
import Additions from "./Additions";
export default function Home() {
  const [click, SetClick] = useState(false);
  const onCliked = () => {
    SetClick(true);
  };
  const cerrar = () => {
    SetClick(false);
  };
  return (
    <div className=" lg:flex md:flex h-screen">
      {click === true ? (
        <Additions cerrar={cerrar}></Additions>
      ) : (
        hamburguesas.map((hamburger, i) => (
          <Card key={i} hamburger={hamburger} onCliked={onCliked}>
            {" "}
          </Card>
        ))
      )}
    </div>
  );
}
