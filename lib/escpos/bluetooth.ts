/**
 * Web Bluetooth transport for ESC/POS thermal printers.
 *
 * Most BT thermal printers expose a "serial-over-GATT" service with a single
 * writable characteristic. There's no universal UUID, so we advertise the
 * handful of services these printers commonly use and then auto-discover the
 * first writable characteristic.
 *
 * Web Bluetooth is Chromium-only (Chrome / Edge / Android Chrome) and requires
 * a secure context (https, which Vercel provides). It must be triggered by a
 * user gesture — call {@link printViaBluetooth} from a click handler.
 */

// Known GATT service UUIDs used by common BT thermal printers.
const PRINTER_SERVICE_UUIDS: (number | string)[] = [
  0x18f0, // common generic thermal printer service (char 0x2af1)
  0xff00, // many Chinese 58mm printers
  0xffe0, // HM-10 / generic serial modules
  0xffe5,
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip transparent UART
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

// Persist the chosen device for the tab so repeat prints skip the chooser.
let cachedDevice: BluetoothDevice | null = null;

function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

async function pickDevice(): Promise<BluetoothDevice> {
  if (cachedDevice) return cachedDevice;
  const device = await navigator.bluetooth.requestDevice({
    // Let the user pick any printer; we still need the services listed so we're
    // allowed to access them after connecting.
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });
  cachedDevice = device;
  device.addEventListener("gattserverdisconnected", () => {
    cachedDevice = null;
  });
  return device;
}

/** Find the first writable characteristic across the printer's services. */
async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
    }
  }
  throw new Error(
    "No writable characteristic found on this device — is it an ESC/POS printer?",
  );
}

/**
 * GATT writes are capped (~512 bytes, often 20 on older stacks). Chunk the
 * payload and prefer write-without-response when the characteristic supports it.
 */
async function writeChunked(
  ch: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
): Promise<void> {
  const chunkSize = 180;
  const useNoResponse = ch.properties.writeWithoutResponse;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (useNoResponse) {
      await ch.writeValueWithoutResponse(chunk);
    } else {
      await ch.writeValueWithResponse(chunk);
    }
  }
}

/**
 * Connect to (or reuse) a BT printer and stream the ESC/POS bytes to it.
 * Throws with a human-readable message on any failure.
 */
export async function printViaBluetooth(data: Uint8Array): Promise<void> {
  if (!bluetoothSupported()) {
    throw new Error(
      "Web Bluetooth isn't available. Use Chrome or Edge on desktop/Android (not iOS).",
    );
  }

  const device = await pickDevice();
  if (!device.gatt) throw new Error("Selected device has no GATT server.");

  const server = device.gatt.connected
    ? device.gatt
    : await device.gatt.connect();
  const ch = await findWritableCharacteristic(server);
  await writeChunked(ch, data);
}

/** Forget the cached printer so the next print re-opens the chooser. */
export function forgetPrinter(): void {
  if (cachedDevice?.gatt?.connected) cachedDevice.gatt.disconnect();
  cachedDevice = null;
}
