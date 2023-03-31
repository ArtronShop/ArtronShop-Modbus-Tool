
import * as React from 'react';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import LoadingButton from '@mui/lab/LoadingButton';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import SettingsIcon from '@mui/icons-material/Settings';

import Co2Icon from '@mui/icons-material/Co2';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import OpacityIcon from '@mui/icons-material/Opacity';

import ATS_CO2_SVG from "../ATS_CO2_SVG";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
} from 'chart.js'
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-moment';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
)

const BoxSensorValue = ({ icon, label, value, uint, ...props }) => <Box sx={{
    borderRadius: 4,
    px: 2,
    py: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    border: "2px solid #ECF0F1",
    ...props.sx,
}}>
    {icon}
    <div style={{
       display: "flex",
       flexDirection: "column", 
       textAlign: "right",
       flexGrow: 1
    }}>
        <div>
            <span style={{
                fontSize: 24,
                color: "#2C3E50"
            }}>{value}</span>
            <span style={{
                fontSize: 12,
                color: "#2C3E50"
            }}>{uint}</span>
        </div>
        <div style={{ 
            color: "#808B96",
            marginTop: -5,
            fontSize: 14
        }}>{label}</div>
    </div>
</Box>;

function crc16(buffer, length) {
    var crc = 0xFFFF;
    var odd;

    for (var i = 0; i < length; i++) {
        crc = crc ^ buffer[i];

        for (var j = 0; j < 8; j++) {
            odd = crc & 0x0001;
            crc = crc >> 1;
            if (odd) {
                crc = crc ^ 0xA001;
            }
        }
    }

    return crc;
};

export default function ATSCO2Test({ serialPort, modbusId }) {
    const [ tabSelect, setTabSelect ] = React.useState(0);
    const handleChangeTabSelect = (e, newValue) => setTabSelect(newValue);

    const [ sensorValue, setSensorValue ] = React.useState([ ]);
    const [ sensorConfigs, setSensorConfigs ] = React.useState({
        id: 1,
        baud_rate: 0,
        temp_correction: 0,
        humi_correction: 0,
        co2_correction: 0
    });

    const handleChangeSensorConfigs = key => (e) => {
        setSensorConfigs({ ...sensorConfigs, [key]: e.target.value });
    }

    const ModbusReadRegister = async (id, function_code, start_address, quantity) => {
        { // Master -> Slave
            const data = new Uint8Array([
                id,                          // Devices Address
                function_code,               // Function code
                (start_address >> 8) & 0xFF, // Start Address HIGH
                start_address & 0xFF,        // Start Address LOW
                (quantity >> 8) & 0xFF,      // Quantity HIGH
                quantity & 0xFF,             // Quantity LOW
                0x00,                        // CRC LOW
                0x00                         // CRC HIGH
            ]);
            const crc = crc16(data, data.length - 2);
            data[data.length - 2] = crc & 0xFF;
            data[data.length - 1] = (crc >> 8) & 0xFF;

            const writer = serialPort.writable.getWriter();
            writer.write(data);
            writer.releaseLock();
        }

        { // Master <- Slave
            const recv_bytes = (2 * quantity);
            const read_len = 1 + 1 + 1 + recv_bytes + 2; // ID, Function, Bytes Size, <Data>, <CRC *2>

            const reader = serialPort.readable.getReader();
            const data_recv = await (new Promise(async (resolve, reject) => {
                let data = [];
                setTimeout(() => {
                    reader.cancel();
                }, 1000); // wait max 2 sec

                let state = 0;
                while (1) {
                    const { value, done } = await reader.read();
                    if (value) {
                        data = data.concat(value);
                    }
                    if (data.length >= read_len) {
                        reader.cancel();
                    }
                    if (done) {
                        resolve(data);
                        break;
                    }
                }
            }));
            if (serialPort.readable.lock) {
                await reader.releaseLock();
            }

            if (data_recv.length != read_len) {
                throw "recv len invalid";
            }

            if (data_recv[0] != id) {
                throw "recv id invalid";
            }

            if (data_recv[1] != function_code) {
                throw "recv function code invalid";
            }

            if (data_recv[2] != recv_bytes) {
                throw "recv data size invalid";
            }

            const crc = crc16(data_recv, data_recv.length - 2);
            if ((data_recv[read_len - 2] != (crc & 0xFF)) || (data_recv[read_len - 2] != ((crc >> 8) & 0xFF))) {
                throw "recv crc invalid";
            }

            const only_data = [];
            for (let i=3;i<(read_len - 2);i++) {
                only_data.push(data_recv[i]);
            }
            return only_data;
        }

        return null;
    }

    const read_sensor_value_polling = async () => {
        try {
            const data = await ModbusReadRegister(modbusId, 4, 0x0001, 3);

            const temp = ((data[0] << 8) | data[1]) / 10.0;
            const humi = ((data[2] << 8) | data[3]) / 10.0;
            const co2 = (data[4] << 8 | data[5]);

            setSensorValue([ ...sensorValue ].concat({
                time: new Date(),
                temp,
                humi,
                co2
            }));
        } catch(e) {
            console.error(e);
        }

        window.read_timer = setTimeout(read_sensor_value_polling, 1000); // 1 sec
    }

    const read_settings_once = async () => {
        try {
            const data = await ModbusReadRegister(modbusId, 4, 0x0101, 5);

            const id = ((data[0] << 8) | data[1]);
            const baud_rate = ((data[2] << 8) | data[3]);
            const temp_correction  = ((data[4] << 8) | data[5]) / 10.0;
            const humi_correction  = ((data[6] << 8) | data[7]) / 10.0;
            const co2_correction  = (data[8] << 8 | data[9]);

            setSensorConfigs([ ...sensorValue ].concat({
                id,
                baud_rate,
                temp_correction,
                humi_correction,
                co2_correction
            }));
        } catch(e) {
            console.error(e);
        }
    }

    React.useEffect(() => {
        if (serialPort) {
            if (tabSelect === 0) { // อ่านค่า
                read_sensor_value_polling();
            } else if (tabSelect === 1) { // ตั้งค่า
                read_settings_once();
            }
        }

        return () => {
            if (window.read_timer) {
                clearTimeout(window.read_timer);
                window.read_timer = null;
            }
        }
    }, [ serialPort, tabSelect ]);

    

	return (
		<>
            <Container maxWidth="lg">
                <Box pt={4}>
                    <Grid container spacing={2}>
                        <Grid item md={3}>
                            <ATS_CO2_SVG 
                                style={{
                                    display: "block",
                                    width: "100%",
                                    height: 400
                                }}
                            />
                            <Box>
                                <Paper p={1}>

                                </Paper>
                            </Box>
                        </Grid>
                        <Grid item xs={9}>
                            <Paper>
                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                    <Tabs value={tabSelect} onChange={handleChangeTabSelect} centered>
                                        <Tab label="อ่านค่า" icon={<SsidChartIcon />} />
                                        <Tab label="ตั้งค่า" icon={<SettingsIcon />} />
                                    </Tabs>
                                </Box>
                                {tabSelect === 0 && <Box p={2}>
                                    <Grid container spacing={2} justifyContent="space-around">
                                        {[
                                            {
                                                icon: <Co2Icon sx={{ fontSize: 50, color: "#2C3E50" }} />,
                                                label: "CO2",
                                                value: (sensorValue.length > 0 && sensorValue[sensorValue.length - 1].co2) || "\u00A0",
                                                uint: "ppm"
                                            },
                                            {
                                                icon: <ThermostatIcon sx={{ fontSize: 50, color: "#2C3E50" }} />,
                                                label: "อุณหภูมิ",
                                                value: (sensorValue.length > 0 && sensorValue[sensorValue.length - 1].temp.toFixed(1)) || "\u00A0",
                                                uint: "°C"
                                            },
                                            {
                                                icon: <OpacityIcon sx={{ fontSize: 50, color: "#2C3E50" }} />,
                                                label: "ความชื้น",
                                                value: (sensorValue.length > 0 && sensorValue[sensorValue.length - 1].humi.toFixed(1)) || "\u00A0",
                                                uint: "%RH"
                                            },
                                        ].map((a, index) => <Grid key={index} item md={4} sx={{ display: "flex", justifyContent: "center" }}>
                                            <BoxSensorValue
                                                {...a}
                                                sx={{
                                                    width: 160
                                                }}
                                            />
                                        </Grid>)}
                                    </Grid>
                                    <Box sx={{ mt: 2 }}>
                                        <Line
                                            options={{
                                                responsive: true,
                                                interaction: {
                                                    intersect: false,
                                                },
                                                locale: "th",
                                                scales: {
                                                    x: {
                                                        type: 'time',
                                                        time: {
                                                            tooltipFormat: 'DD/MM/YYYY',
                                                            unit: 'day'
                                                        },
                                                        title: {
                                                            display: false,
                                                        },
                                                        adapters: {
                                                            date: {
                                                                locale: "th"
                                                            }
                                                        },
                                                    },
                                                    y: {
                                                        display: false,
                                                    },
                                                }
                                            }}
                                            data={{
                                                labels: sensorValue.map(a => a.time),
                                                datasets: [
                                                    {
                                                        label: 'CO2 (ppm)',
                                                        data: sensorValue.map(a => a.co2),
                                                        fill: false,
                                                        tension: 0.4,
                                                        borderColor: "#2ECC71",
                                                        backgroundColor: "#2ECC71",
                                                    },
                                                    {
                                                        label: 'อุณหภูมิ (°C)',
                                                        data: sensorValue.map(a => a.temp),
                                                        fill: false,
                                                        tension: 0.4,
                                                        borderColor: "#F1C40F",
                                                        backgroundColor: "#F1C40F",
                                                    },
                                                    {
                                                        label: 'ความชื้น (%RH)',
                                                        data: sensorValue.map(a => a.humi),
                                                        fill: false,
                                                        tension: 0.4,
                                                        borderColor: "#3498DB",
                                                        backgroundColor: "#3498DB",
                                                    },
                                                ]
                                            }}
                                        />
                                    </Box>
                                </Box>}
                                {tabSelect === 1 && <Box p={3}>
                                    {[
                                        {
                                            key: "id",
                                            label: "หมายเลขอุปกรณ์ (Modbus ID)",
                                            type: "number",
                                            props: {
                                                min: 1,
                                                max: 127
                                            }
                                        },
                                        {
                                            key: "baud_rate",
                                            label: "ความเร็วการสื่อสาร (Baud rate)",
                                            type: "option",
                                            option: [ 9600, 14400, 19200 ]
                                        },
                                        {
                                            key: "temp_correction",
                                            label: "ปรับแต่งอุณหภูมิ (°C)",
                                            type: "number",
                                            isFloat: true,
                                            props: {
                                                min: -10,
                                                max: 10
                                            }
                                        },
                                        {
                                            key: "humi_correction",
                                            label: "ปรับแต่งความชื้น (%RH)",
                                            type: "number",
                                            isFloat: true,
                                            props: {
                                                min: -10,
                                                max: 10
                                            }
                                        },
                                        {
                                            key: "co2_correction",
                                            label: "ปรับแต่ง CO2 (ppm)",
                                            type: "number",
                                            isFloat: true,
                                            props: {
                                                min: -1000,
                                                max: 1000
                                            }
                                        }
                                    ].map((a, index) => <Box key={index} mb={2} sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}>
                                        <div>{a.label}</div>
                                        {a.type === "number" && <TextField
                                            type="number"
                                            size="small"
                                            sx={{ width: 80 }}
                                            value={sensorConfigs[a.key]}
                                            onChange={handleChangeSensorConfigs(a.key)}
                                            {...a.props}
                                        />}
                                        {a.type === "option" && <Select
                                            size="small"
                                            sx={{ width: 100 }}
                                            value={sensorConfigs[a.key]}
                                            onChange={handleChangeSensorConfigs(a.key)}
                                            {...a.props}
                                        >
                                            {a.option.map((a, index) => <MenuItem key={index} value={index}>{a}</MenuItem>)}
                                        </Select>}
                                    </Box>)}
                                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                        <LoadingButton variant="contained" disableElevation>บันทึก</LoadingButton>
                                    </Box>
                                </Box>}
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            </Container>
		</>
	)
}
