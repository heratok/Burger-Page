import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import PersonIcon from "@mui/icons-material/Person";
import HomeIcon from "@mui/icons-material/Home";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ReplyIcon from "@mui/icons-material/Reply";
import { useState } from "react";
// eslint-disable-next-line react/prop-types
function Form({ cerrar, cerrarForm, mostrar, hamburguesas }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState(0);
  const [barrio, setBarrio] = useState("");
  const [dir, setDir] = useState("");
  const [metodo, setMetodo] = useState("Efectivo");
  const [mensaje, setMensaje] = useState(0);
  // eslint-disable-next-line react/prop-types
  const calcularTotal = hamburguesas.reduce(
    (total, burger) => total + burger.totalapagar,
    0
  );
  console.log("hambu", hamburguesas);
  // eslint-disable-next-line react/prop-types
  const pedido = hamburguesas.map(
    (hamburger) =>
      `\u2022 ${hamburger.cantidad} x - ${
        hamburger.name.toUpperCase()
      } ${hamburger.adicion.map((e)=>`(${e.cantidad} x ${e.name})`)}  ($ ${hamburger.totalapagar.toLocaleString()})${
        hamburger.observacion === ""
          ? ""
          : ` *Observaciones:* ${hamburger.observacion}`
      }\n`
  );
  const pedidoFinal = pedido.join('');
  const info = `https://wa.me/573022575805?text=${encodeURIComponent(`Orden ${Math.floor(
    100000 + Math.random() * 900000
  )} Hola burgerPage soy ${nombre} me gustaría hacer un pedido \n\n*Direccion:* ${dir}\n*Barrio:* ${barrio}\n*Celular:* ${telefono}\n\n*Detalle de la orden:*\n${pedidoFinal}\n\n*Forma de Pago:* ${metodo}\n\n*Total del pedido: ${calcularTotal.toLocaleString()}*\n\n*Comentario:* ${mensaje}\n
*Gracias*.`)}`;
  const ocultar = () => {
    cerrar();
    cerrarForm();
    mostrar();
  };
  const handleClick = (e) => {
    e.preventDefault();
    console.log("name enviar", { nombre, telefono, dir, barrio });
    setTimeout(() => {
      window.open(info, "_blank", "noreferrer");
      console.log("infor en time", info);
    }, 2000);
  };
  console.log(nombre);
  return (
    <form className="max-w-sm mx-auto p-2">
      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Nombres
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <PersonIcon />
        </div>
        <input
          type="text"
          className=" border border-white border-opacity-15 bg-[#181A1B] text-sm rounded-lg focus:ring-blue-500 block w-full ps-10 p-2.5   dark:text-white "
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombres"
        ></input>
      </div>
      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Telefono
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <PhoneAndroidIcon />
        </div>
        <input
          type="text"
          className=" border border-white border-opacity-15 bg-[#181A1B] text-sm rounded-lg focus:ring-blue-500 block w-full ps-10 p-2.5   dark:text-white "
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Telefono"
          onInput={(e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, "");
          }}
        ></input>
      </div>
      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Direccion
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <HomeIcon />
        </div>
        <input
          placeholder="Direccion"
          onChange={(e) => setDir(e.target.value)}
          className=" border border-white border-opacity-15 bg-[#181A1B] text-sm rounded-lg focus:ring-blue-500 block w-full ps-10 p-2.5   dark:text-white "
        ></input>
      </div>

      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Barrio
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <LocationOnIcon />
        </div>
        <input
          type="text"
          onChange={(e) => setBarrio(e.target.value)}
          className=" border border-white border-opacity-15 bg-[#181A1B] text-sm rounded-lg focus:ring-blue-500 block w-full ps-10 p-2.5   dark:text-white "
          placeholder="Barrio"
        ></input>
      </div>

      <div>
        <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Seleccionar metodo de pago
        </label>
        <select
          className="bg-[#181A1B] border border-white border-opacity-15 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5   dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Seleccione un metodo de pago"
          onChange={(e) => setMetodo(e.target.value)}
        >
          <option>Efectivo</option>
          <option>Transferencia</option>
        </select>
      </div>
      <form className="max-w-sm mx-auto">
        <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Mensaje opcional
        </label>
        <textarea
          id="message"
          onChange={(e) => setMensaje(e.target.value)}
          rows="2"
          className="block p-2.5 w-full text-sm  border border-white border-opacity-15 bg-[#181A1B] rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Ingrese un mensaje opcional"
        ></textarea>
      </form>

      <a
        className="text-white mt-2 flex justify-center items-center gap-1 bg-[#FF7A21] hover:bg-orange-400   font-medium rounded-lg text-sm w-full sm:w-full px-5 py-2.5  lg:w-96 text-center"
        href={info}
        onClick={handleClick} // Usa el manejador de clic aquí
        rel="noreferrer"
      >
        <WhatsAppIcon />
        Enviar Orden a WhatsApp
      </a>
      <button
        className="text-white mt-2 flex justify-center items-center gap-1 bg-[#FF7A21] hover:bg-orange-400   font-medium rounded-lg text-sm w-full sm:w-full px-5 py-2.5  lg:w-96 text-center"
        onClick={ocultar}
      >
        <ReplyIcon />
        Volver a la Orden
      </button>
    </form>
  );
}

export default Form;
