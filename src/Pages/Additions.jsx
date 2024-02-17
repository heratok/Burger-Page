/* eslint-disable react/prop-types */
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";
// eslint-disable-next-line react/prop-types
export default function Additions({ cerrar, hamburger }) {
  const [cantidad, setCantidad] = useState(1);

  const adiitions = [
    {
      name: "papas fritas",
      pirce: 10000,
      cantidad: 0,
    },
    {
      name: "Extra queso",
      pirce: 5000,
      cantidad: 0,
    },
    {
      name: "Carne de gato",
      pirce: 50000,
      cantidad: 0,
    },
  ];
  const [adiciones, setAdiciones] = useState(adiitions);
  const [total, setTotal] = useState(hamburger.price);
  const calcular = () => {
    let totales = 0;
    adiciones.forEach((ad) => {
      const suma = ad.cantidad * ad.pirce;
      console.log("suma", suma);
      console.log(ad.cantidad);
      totales += suma;
    });
    setTotal(hamburger.price + totales);
  };
  const aumentar = (adi, pos) => {
    const existingAdiIndex = adiciones.findIndex(
      (item) => item.name === adi.name
    );
    if (existingAdiIndex !== -1) {
      adiciones[existingAdiIndex].cantidad += 1;
      setAdiciones([...adiciones]);
    } else {
      adiciones[pos].cantidad += 1;
      setAdiciones([...adiciones, adiciones[pos]]);
    }
    calcular();
  };
  const aumentarBurger = () => {
    setTotal(total + hamburger.price);
    setCantidad(cantidad + 1);
  };
  const disminuirBurger = () => {
    if (cantidad > 1) {
      setTotal(total - hamburger.price);
      setCantidad(cantidad - 1);
    }
  };
  const disminuir = (adi, pos) => {
    const existingAdiIndex = adiciones.findIndex(
      (item) => item.name === adi.name
    );
    if (existingAdiIndex !== -1) {
      if (adiciones[pos].cantidad > 0) {
        adiciones[existingAdiIndex].cantidad -= 1;
        setAdiciones([...adiciones]);
      }
    }
    calcular();
  };
  return (
    <div className="w-screen h-screen ">
      <div className="flex justify-end w-full">
        <div
          className="flex items-center justify-center w-10 h-10 p-2 rounded-full hover:bg-opacity-10 bg-blue-50 bg-opacity-20"
          onClick={cerrar}
        >
          <CloseIcon></CloseIcon>
        </div>
      </div>

      <div className="flex justify-center">
        <img
          className="w-32 h-32 lg:w-42 lg:h-auto"
          src={hamburger.src}
          alt=""
        />
        <div className="">
          <span className="font-bold">{hamburger.name}</span>
          <p className="text-white text-opacity-50 lg:w-96">
            {hamburger.description}
          </p>
          <span className="text-[#FF7A21]">
            Precio: ${hamburger.price.toLocaleString()}{" "}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center ">
        <div className="flex justify-center">
          <div className="flex justify-between p-2 w-96 lg:p-0">
            <span>Adiciones</span>
            <span className="bg-[#FF7A21] rounded-lg text-[12px] p-2 flex items-center justify-center">
              Opcional
            </span>
          </div>
        </div>
        <div className="mt-2 overflow-y-auto scroll-add h-44">
          {adiitions.map((adicion, i) => (
            <div
              key={i}
              className="flex gap-2 p-2 mt-2 bg-white rounded-lg bg-opacity-10 w-96 "
            >
              <div className="flex w-full gap-2">
                {" "}
                <div className="flex items-center justify-center p-1 bg-white rounded-full bg-opacity-15 w-14 h-14">
                  <img
                    className="rounded-full "
                    src="https://img.freepik.com/fotos-premium/contenedor-amarillo-papas-fritas-cara-cara-sonriente_913665-3058.jpg"
                    alt=""
                  />
                </div>
                <span>
                  {adicion.name}
                  <br />${adicion.pirce.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div
                  className="p-2  h-6 w-6 flex justify-center items-center rounded-full cursor-pointer bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700 "
                  onClick={() => disminuir(adicion, i)}
                >
                  -
                </div>
                <div className="">{adiciones[i].cantidad}</div>
                <div
                  className="p-2 h-6 w-6 cursor-pointer flex justify-center items-center  rounded-full bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700"
                  onClick={() => aumentar(adicion, i)}
                >
                  +
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-4">
          <div className="flex justify-between w-96">
            <span>Observaciones</span>
            <span className="bg-[#FF7A21] rounded-lg text-[12px] p-2 flex items-center justify-center">
              Opcional
            </span>
          </div>
        </div>
      </div>

      <form className="max-w-sm mx-auto mt-4">
        <textarea
          id="message"
          rows="4"
          className="block p-2.5 w-full text-sm text-gray-900 bg-[#181A1B] rounded-lg border border-white focus:ring-blue-500 focus:border-blue-500  dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Observaciones"
        ></textarea>
      </form>
      <div className="flex justify-center">
        <div className="flex justify-between mt-4 w-96">
          <div className="flex items-center justify-center p-2 bg-white rounded-full bg-opacity-5 gap-7">
            <div
              className="p-2 h-7 w-7 flex justify-center items-center rounded-full cursor-pointer bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700"
              onClick={disminuirBurger}
            >
              -
            </div>
            <div className=""> {cantidad}</div>
            <div
              className="p-2 h-7 w-7 cursor-pointer flex justify-center items-center  rounded-full bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700"
              onClick={aumentarBurger}
            >
              +
            </div>
          </div>
          <button
            className="p-2 bg-[#FF7A21] rounded-full hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700"
            onClick={cerrar}
          >
            Agregar ${total.toLocaleString()}{" "}
          </button>
        </div>
      </div>
    </div>
  );
}
