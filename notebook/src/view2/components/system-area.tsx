import { Row, Col } from "antd"

export default function SystemArea() {
    return (
        <div style={{height: '100%', width: '100%', backgroundColor: "#f0f0f0", padding: 10, overflow: 'scroll'}}>
            <div style={{marginBottom:20}}>
                <MemoryData name="IRAM" size={350} used={150}/>
            </div>
            <div style={{marginBottom:20}}>
                <MemoryData name="DRAM" size={200} used={10}/>
            </div>
            <div style={{marginBottom:20}}>
                <MemoryData name="Flash" size={800} used={0} />
            </div>
        </div>
    )
}

function MemoryData(props: {name: string, size: number, used: number}) {

    return (
        <div style={{fontSize: 16}}>
            <div style={{fontWeight: 'bold'}}>{props.name}</div>
            <div style={{color: "#595959"}}>Used: &nbsp;  50% (344B / 654B)</div>
            <div style={{color: "#595959", marginLeft:20}}>Reusable: &nbsp; 24% (344B / 654B)</div>
            <div style={{marginTop:5}}><Memory size={props.size} used={props.used}></Memory></div>
        </div>
    )
}

function Memory(props: {size: number, used: number}) {
    return (
        <Row>
            {new Array(props.size).fill(0).map((_, index) => {
            const key = `col-${index}`;
            return (
                <Col key={key} flex={'1%'}
                style={{
                    backgroundColor: index < props.used ? "#85a5ff" : "#bfbfbf", 
                    height: 8, border: "solid #fafafa 0.05px"}}
                >
                </Col>
            );
            })}
        </Row>
    )
}